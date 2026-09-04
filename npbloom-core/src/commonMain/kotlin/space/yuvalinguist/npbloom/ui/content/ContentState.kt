@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.ui.content

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import space.yuvalinguist.npbloom.changeAt
import space.yuvalinguist.npbloom.content.*
import space.yuvalinguist.npbloom.content.positioned.CoordsInPlot
import space.yuvalinguist.npbloom.content.unpositioned.*
import space.yuvalinguist.npbloom.history.UndoRedoHistory
import space.yuvalinguist.npbloom.history.UndoableActionBase
import space.yuvalinguist.npbloom.insertAt
import space.yuvalinguist.npbloom.removeAt
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.js.JsName

private typealias PlotIndex = Int

@JsExport
@Serializable
data class ContentState(
    @SerialName("p") @JsName("plotsAsKtList") val plots: List<UnpositionedPlot>
) {
    @JsName("plots") val plotsAsArray get() = plots.toTypedArray()
}

private val initialState = ContentState(listOf(UnpositionedPlot()))

internal sealed interface ContentOrHistoryAction

data object Undo : ContentOrHistoryAction
data object Redo : ContentOrHistoryAction

private sealed interface ContentAction : UndoableActionBase, ContentOrHistoryAction

data object AddPlot : ContentAction
internal data class DeletePlot(val plotIndex: PlotIndex) : ContentAction
internal data class ResetPlot(val plotIndex: PlotIndex) : ContentAction
internal data class InsertNode(val plotIndex: PlotIndex, val treeId: Id, val newNode: InsertedNode) : ContentAction
internal data class DeleteNodes(val plotIndex: PlotIndex, val nodeIndicators: Set<NodeIndicatorInPlot>) : ContentAction
internal data class DeleteTrees(val plotIndex: PlotIndex, val treeIds: Set<Id>) : ContentAction
internal data class AdoptNodes(
    val plotIndex: PlotIndex,
    val treeId: Id,
    val adoptingNodeId: Id,
    val adoptedNodeIds: Set<Id>
) : ContentAction

internal data class DisownNodes(
    val plotIndex: PlotIndex,
    val treeId: Id,
    val disowningNodeId: Id,
    val disownedNodeIds: Set<Id>
) : ContentAction

internal data class MoveNodes(
    val plotIndex: PlotIndex,
    val nodeIndicators: Set<NodeIndicatorInPlot>,
    val offsetD: TreeCoordsOffset
) : ContentAction

internal data class MoveTrees(
    val plotIndex: PlotIndex,
    val treeIds: Set<Id>,
    val offsetD: PlotCoordsOffset
) : ContentAction

internal data class ResetNodePositions(val plotIndex: PlotIndex, val nodeIndicators: Set<NodeIndicatorInPlot>) :
    ContentAction

internal data class SetNodeLabel(
    val plotIndex: PlotIndex,
    val nodeIndicator: NodeIndicatorInPlot,
    val newLabel: String
) : ContentAction

internal data class SetNodeSlice(
    val plotIndex: PlotIndex,
    val nodeIndicator: NodeIndicatorInPlot,
    val newSlice: StringSlice,
    val triangle: Boolean,
) : ContentAction

internal data class SetTriangle(
    val plotIndex: PlotIndex,
    val nodeIndicators: Set<NodeIndicatorInPlot>,
    val triangle: Boolean
) : ContentAction

internal data class SetSentence(
    val plotIndex: PlotIndex,
    val treeId: Id,
    val newSentence: Sentence,
    val oldSelectedSlice: StringSlice
) : ContentAction

internal data class SetSliceStrikethrough(
    val plotIndex: PlotIndex,
    val treeId: Id,
    val slice: StringSlice,
    val strikethrough: Boolean
) : ContentAction

internal data class AddTree(
    val plotIndex: PlotIndex,
    val newTreeId: Id,
    val coordsInPlot: CoordsInPlot,
    val sentence: Sentence = "",
    val nodes: EntitySet<UnpositionedNode> = EntitySet(),
) : ContentAction

internal data class SetTreeContent(
    val plotIndex: PlotIndex,
    val treeId: Id,
    val sentence: Sentence,
    val nodes: EntitySet<UnpositionedNode>,
) : ContentAction

internal data class DeleteTree(val plotIndex: PlotIndex, val treeId: Id) : ContentAction
internal data class AddShape(val plotIndex: PlotIndex, val newShape: PlotShape) : ContentAction
internal data class DeleteShapes(val plotIndex: PlotIndex, val shapeIds: Set<Id>) : ContentAction
internal data class MoveShapes(val plotIndex: PlotIndex, val shapeIds: Set<Id>, val offset: PlotCoordsOffset) : ContentAction
internal data class TransformShape(val plotIndex: PlotIndex, val shapeId: Id, val newShape: PlotShape) : ContentAction
internal data class FoldNodes(val plotIndex: PlotIndex, val nodeIndicators: Set<NodeIndicatorInPlot>) : ContentAction
internal data class UnfoldNodes(val plotIndex: PlotIndex, val nodeIndicators: Set<NodeIndicatorInPlot>) : ContentAction
internal data class UnfoldNodesOneLevel(val plotIndex: PlotIndex, val nodeIndicators: Set<NodeIndicatorInPlot>) : ContentAction

@JsExport
sealed interface ContentChange : UndoableActionBase

internal data class PlotAdded(val newPlotIndex: PlotIndex, val newPlot: UnpositionedPlot) : ContentChange
internal data class PlotChanged(val plotIndex: PlotIndex, val old: UnpositionedPlot, val new: UnpositionedPlot) :
    ContentChange

internal data class PlotDeleted(val plotIndex: PlotIndex, val removedPlot: UnpositionedPlot) : ContentChange
internal data class TreeAdded(val plotIndex: PlotIndex, val newTree: UnpositionedTree) : ContentChange
internal data class TreeChanged(val plotIndex: PlotIndex, val old: UnpositionedTree, val new: UnpositionedTree) :
    ContentChange

internal data class TreeDeleted(val plotIndex: PlotIndex, val removedTree: UnpositionedTree) : ContentChange
internal data class ShapeAdded(val plotIndex: PlotIndex, val newShape: PlotShape) : ContentChange
internal data class ShapeChanged(val plotIndex: PlotIndex, val old: PlotShape, val new: PlotShape) : ContentChange
internal data class ShapeDeleted(val plotIndex: PlotIndex, val removedShape: PlotShape) : ContentChange

private fun makeUndoable(state: ContentState, action: ContentAction): ContentChange = when (action) {
    AddPlot -> PlotAdded(state.plots.size, UnpositionedPlot())
    is DeletePlot -> PlotDeleted(action.plotIndex, state.plots[action.plotIndex])
    is ResetPlot -> PlotChanged(action.plotIndex, state.plots[action.plotIndex], UnpositionedPlot())
    is InsertNode -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.treeId),
        state.plots[action.plotIndex].tree(action.treeId).insertNode(action.newNode)
    )

    is DeleteNodes -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].deleteNodes(action.nodeIndicators)
    )

    is DeleteTrees -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].deleteTrees(action.treeIds)
    )

    is AdoptNodes -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.treeId),
        state.plots[action.plotIndex].tree(action.treeId).adoptNodes(action.adoptingNodeId, action.adoptedNodeIds)
    )

    is DisownNodes -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.treeId),
        state.plots[action.plotIndex].tree(action.treeId).disownNodes(action.disowningNodeId, action.disownedNodeIds)
    )

    is MoveNodes -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformNodes(action.nodeIndicators) { it.changeOffset(action.offsetD) }
    )

    is MoveTrees -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformTrees(action.treeIds) { it.changePosition(action.offsetD) }
    )

    is ResetNodePositions -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformNodes(action.nodeIndicators) { it.withOffset(TreeCoordsOffset.ZERO) }
    )

    is SetNodeLabel -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.nodeIndicator.treeId),
        state.plots[action.plotIndex].tree(action.nodeIndicator.treeId)
            .transformNode(action.nodeIndicator.nodeId) { it.withLabel(action.newLabel) }
    )

    is SetNodeSlice -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.nodeIndicator.treeId),
        state.plots[action.plotIndex].tree(action.nodeIndicator.treeId)
            .transformNode(action.nodeIndicator.nodeId) {
                UnpositionedTerminalNode(it.id, it.label, slice = action.newSlice, triangle = action.triangle)
            }
    )

    is SetTriangle -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformNodes(
            action.nodeIndicators
        ) { if (it is UnpositionedTerminalNode) it.copy(triangle = action.triangle) else it }
    )

    is SetSentence -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.treeId),
        state.plots[action.plotIndex].tree(action.treeId)
            .handleLocalSentenceChange(action.newSentence, action.oldSelectedSlice)
    )

    is SetSliceStrikethrough -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.treeId),
        state.plots[action.plotIndex].tree(action.treeId).let { tree ->
            tree.copy(strikethroughs =
                if (action.strikethrough) tree.strikethroughs + action.slice
                else tree.strikethroughs.flatMap { it - action.slice })
        }
    )

    is AddTree -> TreeAdded(
        action.plotIndex,
        UnpositionedTree(action.newTreeId, action.sentence, action.nodes, coordsInPlot = action.coordsInPlot)
    )

    is SetTreeContent -> TreeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].tree(action.treeId),
        state.plots[action.plotIndex].tree(action.treeId).copy(sentence = action.sentence, nodes = action.nodes)
    )

    is DeleteTree -> TreeDeleted(action.plotIndex, state.plots[action.plotIndex].tree(action.treeId))

    is FoldNodes -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformNodes(action.nodeIndicators) {
            if (it is UnpositionedBranchingNode) it.copy(folded = true) else it
        }
    )

    is UnfoldNodes -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformNodes(action.nodeIndicators) {
            if (it is UnpositionedBranchingNode) it.copy(folded = false) else it
        }
    )

    is UnfoldNodesOneLevel -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformNodes(action.nodeIndicators) {
            if (it is UnpositionedBranchingNode) it.copy(folded = false) else it
        }.transformChildrenOfNodes(action.nodeIndicators) {
            if (it is UnpositionedBranchingNode) it.copy(folded = true) else it
        }
    )

    is AddShape -> ShapeAdded(action.plotIndex, action.newShape)

    is DeleteShapes -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].deleteShapes(action.shapeIds)
    )

    is MoveShapes -> PlotChanged(
        action.plotIndex,
        state.plots[action.plotIndex],
        state.plots[action.plotIndex].transformShapes(action.shapeIds) { it.move(action.offset) }
    )

    is TransformShape -> ShapeChanged(
        action.plotIndex,
        state.plots[action.plotIndex].shapes[action.shapeId]!!,
        action.newShape
    )
}

private fun applyUndoableAction(state: ContentState, action: ContentChange): ContentState = when (action) {
    is PlotAdded -> state.copy(plots = state.plots.insertAt(action.newPlotIndex, action.newPlot))
    is PlotChanged -> state.copy(plots = state.plots.changeAt(action.plotIndex, action.new))
    is PlotDeleted -> state.copy(plots = state.plots.removeAt(action.plotIndex))
    is TreeAdded -> state.copy(
        plots = state.plots.changeAt(
            action.plotIndex,
            state.plots[action.plotIndex].setTree(action.newTree)
        )
    )

    is TreeChanged -> state.copy(
        plots = state.plots.changeAt(
            action.plotIndex,
            state.plots[action.plotIndex].setTree(action.new)
        )
    )

    is TreeDeleted -> state.copy(
        plots = state.plots.changeAt(
            action.plotIndex,
            state.plots[action.plotIndex].removeTree(action.removedTree.id)
        )
    )

    is ShapeAdded -> state.copy(
        plots = state.plots.changeAt(
            action.plotIndex,
            state.plots[action.plotIndex].setShape(action.newShape)
        )
    )

    is ShapeChanged -> state.copy(
        plots = state.plots.changeAt(
            action.plotIndex,
            state.plots[action.plotIndex].setShape(action.new)
        )
    )

    is ShapeDeleted -> state.copy(
        plots = state.plots.changeAt(
            action.plotIndex,
            state.plots[action.plotIndex].removeShape(action.removedShape.id)
        )
    )
}

private fun reverseUndoableAction(action: ContentChange): ContentChange = when (action) {
    is PlotAdded -> PlotDeleted(action.newPlotIndex, action.newPlot)
    is PlotChanged -> action.copy(old = action.new, new = action.old)
    is PlotDeleted -> PlotAdded(action.plotIndex, action.removedPlot)
    is TreeAdded -> TreeDeleted(action.plotIndex, action.newTree)
    is TreeChanged -> action.copy(old = action.new, new = action.old)
    is TreeDeleted -> TreeAdded(action.plotIndex, action.removedTree)
    is ShapeAdded -> ShapeDeleted(action.plotIndex, action.newShape)
    is ShapeChanged -> action.copy(old = action.new, new = action.old)
    is ShapeDeleted -> ShapeAdded(action.plotIndex, action.removedShape)
}

typealias UndoableContentState = UndoRedoHistory<ContentState, ContentChange>

internal val initialContentState: UndoableContentState =
    UndoRedoHistory(::applyUndoableAction, ::reverseUndoableAction, initialState)

internal fun contentReducer(state: UndoableContentState, action: ContentOrHistoryAction): UndoableContentState =
    when (action) {
        Undo -> state.undo()
        Redo -> state.redo()
        is ContentAction -> state.applyAction(makeUndoable(state.current, action))
    }
