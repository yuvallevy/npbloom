@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content.positioned

import space.yuvalinguist.npbloom.content.*
import space.yuvalinguist.npbloom.content.unpositioned.*
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

const val DEFAULT_TERMINAL_NODE_Y = -2.0
const val DEFAULT_TRIANGLE_NODE_Y = -20.0
const val DEFAULT_NODE_LEVEL_DIFF = -40.0

typealias StrWidthFunc = (str: String) -> Double

internal fun sliceOffsetAndWidth(strWidthFunc: StrWidthFunc, sentence: Sentence, slice: StringSlice): Pair<Double, Double> {
    val (sliceStart, sliceEndExclusive) = slice
    val widthBeforeSlice = strWidthFunc(sentence.slice(0 until sliceStart))
    val sliceWidth = strWidthFunc(sentence.slice(sliceStart until sliceEndExclusive))
    return Pair(widthBeforeSlice, sliceWidth)
}

internal fun determineNaturalParentNodePosition(childNodePositions: Set<CoordsInTree>): CoordsInTree =
    // Branching nodes are positioned as follows:
    // X - average of all X positions of its direct descendants (regardless of any descendants further down the tree)
    // Y - a certain distance above the topmost child node
    CoordsInTree(
        treeX = childNodePositions.map { it.treeX }.average(),
        treeY = childNodePositions.minOf { it.treeY } + DEFAULT_NODE_LEVEL_DIFF
    )

internal fun determineBranchingNodePosition(
    alreadyPositionedNodes: EntitySet<PositionedNode>,
    node: UnpositionedBranchingNode,
): CoordsInTree {
    val positionedChildNodes = alreadyPositionedNodes.filter { it.id in node.children }
    val naturalPosition =
        determineNaturalParentNodePosition(positionedChildNodes.map { it.position }.toSet())
    return CoordsInTree(
        treeX = naturalPosition.treeX + node.offset.dTreeX,
        treeY = naturalPosition.treeY + node.offset.dTreeY,
    )
}

internal fun determineTerminalNodePosition(
    strWidthFunc: StrWidthFunc,
    sentence: Sentence,
    node: UnpositionedTerminalNode
): CoordsInTree {
    // Terminal nodes are positioned as follows:
    // X - exact center of the assigned slice, as measured in pixels
    // Y - a little above the slice if it is not a triangle node; a larger distance above the slice if it is
    val (widthBeforeSlice, sliceWidth) = sliceOffsetAndWidth(strWidthFunc, sentence, node.slice)
    return CoordsInTree(
        treeX = widthBeforeSlice + (sliceWidth / 2) + node.offset.dTreeX,
        treeY = (if (node.triangle) DEFAULT_TRIANGLE_NODE_Y else DEFAULT_TERMINAL_NODE_Y) + node.offset.dTreeY,
    )
}

internal fun determineStringSliceXRange(
    strWidthFunc: StrWidthFunc,
    sentence: Sentence,
    slice: StringSlice,
): TreeXRange {
    val (widthBeforeSlice, sliceWidth) = sliceOffsetAndWidth(strWidthFunc, sentence, slice)
    return TreeXRange(widthBeforeSlice, widthBeforeSlice + sliceWidth)
}

internal fun determineTerminalNodeTriangleRange(
    strWidthFunc: StrWidthFunc,
    sentence: Sentence,
    node: UnpositionedTerminalNode,
): TreeXRange? =
    if (node.triangle) determineStringSliceXRange(strWidthFunc, sentence, node.slice) else null

internal fun determineStrandedNodePosition(
    strWidthFunc: StrWidthFunc,
    unpositionedTree: UnpositionedTree,
    node: UnpositionedStrandedNode
): CoordsInTree = when (node) {
    is UnpositionedFormerlyTerminalNode -> {  // Node was terminal - determine its position based on its slice
        val (widthBeforeSlice, sliceWidth) = sliceOffsetAndWidth(strWidthFunc, unpositionedTree.sentence, node.formerSlice)
        CoordsInTree(
            treeX = widthBeforeSlice + (sliceWidth / 2) + node.offset.dTreeX,
            treeY = (if (node.formerlyTriangle) DEFAULT_TRIANGLE_NODE_Y else DEFAULT_TERMINAL_NODE_Y) + node.offset.dTreeY,
        )
    }

    is UnpositionedFormerlyBranchingNode -> {  // Node was branching - determine its position based on past children
        val positionedChildNodes = applyNodePositions(node.formerDescendants, unpositionedTree, strWidthFunc)
        CoordsInTree(
            treeX = positionedChildNodes.map { it.position.treeX }.average() + node.offset.dTreeX,
            treeY = positionedChildNodes.minOf { it.position.treeY } + DEFAULT_NODE_LEVEL_DIFF + node.offset.dTreeY,
        )
    }

    is UnpositionedPlainStrandedNode ->  // Node was never anything other than stranded - just use its X and Y offset
        CoordsInTree(treeX = node.offset.dTreeX, treeY = node.offset.dTreeY)
}

/**
 * Returns a positioned node corresponding to the given unpositioned node, based on already assigned node positions,
 * width calculation function and sentence associated with the tree.
 */
internal fun applyNodePosition(
    alreadyPositionedNodes: EntitySet<PositionedNode>,
    strWidthFunc: StrWidthFunc,
    unpositionedTree: UnpositionedTree,
    node: UnpositionedNode,
): PositionedNode = when (node) {
    is UnpositionedBranchingNode ->
        // If a branching node is folded, it will be displayed as if it were a terminal node,
        // so when positioning we simply use a terminal node as a stand-in
        if (node.folded) {
            val slice = unpositionedTree.findSlice(node.id) ?: throw IllegalStateException(
                "Cannot fold ${node.label} node with ID ${node.id} because its slice cannot be determined"
            )
            val terminalNode = UnpositionedTerminalNode(
                id = node.id, label = node.label, slice = slice, triangle = true, offset = node.offset,
                folded = true, yAlignMode = node.yAlignMode,
            )
            applyNodePosition(alreadyPositionedNodes, strWidthFunc, unpositionedTree, terminalNode)
        } else PositionedBranchingNode(
            id = node.id, label = node.label, children = node.children, yAlignMode = node.yAlignMode,
            position = determineBranchingNodePosition(alreadyPositionedNodes, node),
        )

    is UnpositionedTerminalNode -> PositionedTerminalNode(
        id = node.id, label = node.label, slice = node.slice, folded = node.folded, yAlignMode = node.yAlignMode,
        triangle = determineTerminalNodeTriangleRange(strWidthFunc, unpositionedTree.sentence, node),
        position = determineTerminalNodePosition(strWidthFunc, unpositionedTree.sentence, node),
    )

    is UnpositionedStrandedNode -> PositionedStrandedNode(
        id = node.id, label = node.label, yAlignMode = node.yAlignMode,
        position = determineStrandedNodePosition(strWidthFunc, unpositionedTree, node),
    )
}

/**
 * Receives an ID map of unpositioned nodes and returns an equivalent map of nodes with assigned positions.
 * This function is recursive and progressively assigns positions to more and more nodes until the whole tree is filled.
 */
internal tailrec fun applyNodePositions(
    nodes: EntitySet<UnpositionedNode>,
    unpositionedTree: UnpositionedTree,
    strWidthFunc: StrWidthFunc,
    alreadyPositionedNodes: EntitySet<PositionedNode> = EntitySet(),
): EntitySet<PositionedNode> {
    // If no unpositioned nodes are left, we're done
    if (nodes.isEmpty()) return alreadyPositionedNodes.mapToNewEntitySet { positionedNode ->
        if (positionedNode.yAlignMode == YAlignMode.Top) {
            val parent = alreadyPositionedNodes
                .find { it is PositionedBranchingNode && positionedNode.id in it.children } as PositionedBranchingNode
            val siblings = (parent.children - positionedNode.id).mapNotNull { alreadyPositionedNodes[it] }
            val minTreeY = siblings.minOf { it.position.treeY }
            positionedNode.withPosition(positionedNode.position.treeX, minTreeY)
        } else positionedNode
    }

    // First figure out which nodes should not be rendered at all
    // Currently this only includes descendants of folded branching nodes
    val hiddenNodes = nodes.descendantsOfFolded()

    // Nodes that can be positioned at this point in the process are:
    // * Terminal nodes, whose position is entirely based on their assigned slice
    // * Folded branching nodes, which are treated as terminal nodes for rendering purposes
    // * Stranded nodes, which internally store the descendants or slice that they once had
    // * Branching nodes whose children all have known positions
    val nodesToPositionNow = nodes.filter { unpositionedNode ->
        unpositionedNode !is UnpositionedBranchingNode ||
                unpositionedNode.children.all { it in alreadyPositionedNodes } ||
                unpositionedNode.folded
    } - hiddenNodes

    // Assign positions to all the nodes we've determined to be ready for positioning
    val newPositionedNodes = nodesToPositionNow.map {
        applyNodePosition(alreadyPositionedNodes, strWidthFunc, unpositionedTree, it)
    }

    // All other nodes will be positioned in one of the next iterations
    val nodesToPositionNext = nodes.filter { it.id !in nodesToPositionNow } - hiddenNodes

    // Repeat the process, using as unpositioned nodes only those nodes that are have not been assigned positions yet
    return applyNodePositions(
        nodes = nodesToPositionNext,
        unpositionedTree = unpositionedTree,
        strWidthFunc = strWidthFunc,
        alreadyPositionedNodes = alreadyPositionedNodes + newPositionedNodes
    )
}

/**
 * Returns a copy of the given tree with positions for all nodes.
 */
internal fun applyNodePositionsToTree(strWidthFunc: StrWidthFunc, tree: UnpositionedTree): PositionedTree =
    PositionedTree(
        id = tree.id,
        sentence = tree.sentence,
        nodes = applyNodePositions(tree.nodes, tree, strWidthFunc),
        position = CoordsInPlot(tree.coordsInPlot.plotX, tree.coordsInPlot.plotY),
        width = strWidthFunc(tree.sentence),
        strikethroughXRanges = tree.strikethroughs.map { slice ->
            determineStringSliceXRange(strWidthFunc, tree.sentence, slice)
        },
    )

/**
 * Returns a copy of the given plot with positions for all trees and nodes.
 */
@JsExport
fun applyNodePositionsToPlot(strWidthFunc: StrWidthFunc, plot: UnpositionedPlot): PositionedPlot =
    PositionedPlot(
        trees = plot.trees.mapToNewEntitySet { tree -> applyNodePositionsToTree(strWidthFunc, tree) },
        shapes = plot.shapes,
    )

/**
 * Receives an array of node IDs in the given tree and returns them sorted by X-coordinate.
 */
internal fun sortNodesByXCoord(strWidthFunc: StrWidthFunc, tree: UnpositionedTree, nodeIds: Set<Id>): List<Id> =
    applyNodePositionsToTree(strWidthFunc, tree).sortNodesByXCoord(nodeIds)
