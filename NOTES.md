# NPBloom: technical notes

This is a comprehensive technical documentation of the NPBloom project, covering the architecture, design decisions, and implementation details of both the `npbloom-core` library and the `npbloom-web` application. It is intended for human contributors and their AI assistants to help navigate the codebase and contribute effectively.

## Architecture overview

As mentioned in the [README](README.md), NPBloom is divided into two main components:
* `npbloom-core`: A Kotlin Multiplatform library that implements the core logic of the application. This includes the data structures for representing syntax trees, algorithms for manipulating them, and some underlying platform-agnostic UI logic.
* `npbloom-web`: A web application built with React and TypeScript that provides the user interface for creating and editing syntax trees. It is a wrapper around `npbloom-core`, using it for the underlying logic while implementing the UI and rendering logic in TypeScript.

The two components are designed so that `npbloom-web` is completely dependent on `npbloom-core` for everything except the most superficial details, but `npbloom-core` does not know or care about `npbloom-web`. This allows for the possibility of other frontends in the future (e.g. a desktop application) that can reuse the core logic.

## `npbloom-core`

The `npbloom-core` library is implemented in Kotlin Multiplatform. Its base package is `space.yuvalinguist.npbloom`, which contains the following subpackages:
* `content`: Contains the data structures for representing syntax trees, as well as algorithms for manipulating them and determining their layout when rendering. If `npbloom-core` has its own core, this is it.
* `history`: Implements the undo/redo functionality, allowing users to revert or reapply changes to their trees. This package is small but important, and understanding it is crucial for implementing any interaction between the UI and the core logic.
* `ui`: Contains logic for state management and defining what user interactions are possible. This is platform-agnostic and does not contain any actual UI code, but it defines the logic for how the UI should behave in response to user actions, and acts as the bridge between any frontend and the core logic.

### `content` package

#### Unpositioned structures

The central data structures in the `content` package are `UnpositionedPlot`, `UnpositionedTree`, and the subclasses of `UnpositionedNode`, which represent the core data structures for syntax trees. These classes are "unpositioned" because they do not contain any information about the layout of the tree when rendered; they only represent the abstract structure of the tree and the relationships between nodes.

A "plot" is a canvas on which trees are drawn. A plot can contain any number of trees, and trees can be moved around on the plot independently of each other. This allows for more flexible layouts, such as having multiple trees side by side for comparison, or illustrating a progression of trees over time.

NB: The word "forest" appears in the codebase a few times, but it is used in the sense of a collection of _plots_ rather than a collection of trees. This differs from the meaning of "forest" in graph theory, which corresponds more closely with "plot" as used here. There is no dedicated `UnpositionedForest` data structure; the collection of plots currently loaded is managed as part of the UI state. (While designing this logic I was also working on an unrelated app for actual foresters, dealing with real-life trees on physical plots of forest land - hence the extended metaphor 🙃)

Another class that features throughout the package is `EntitySet<T>`, which is a relatively unsophisticated generic data structure for storing "things with IDs" in it. It is a bit of a cross between a `Set<T>` and a `Map<Id, T>`, allowing ergonomic iteration over the values as if it were a set, while also allowing O(1) lookup by ID as if it were a map. Internally, objects are stored in a `Map<Id, T>`, but the class mirrors the API of a `Set<T>` as closely as possible. It does not extend or implement any collection interfaces in order to facilitate interop with JS.

`UnpositionedPlot` and `UnpositionedTree` both use `EntitySet` to store their child entities: a plot has an `EntitySet<UnpositionedTree>` and a tree has an `EntitySet<UnpositionedNode>`. `UnpositionedTree` also includes its corresponding sentence as a string, which is used for rendering the sentence below the tree and for various operations that involve the words.

Despite their names, `UnpositionedTree` and the subclasses of `UnpositionedNode` do include _some_ positioning information - just the minimum required for determining the actual positions of the rendered elements later.

* `UnpositionedTree` includes `coordsInPlot`, which is the coordinates of the tree as a whole within the plot. The anchor point for a tree is the top-left corner of the bounding box **of the sentence** (not of the tree itself). This is because the sentence is positioned first, and the tree is built upwards on top of it, with all the nodes in the tree having a negative Y position with respect to the tree itself. This will become important later as we discuss the layout algorithm.

* `UnpositionedNode` includes `offset`, which is the offset of the node from its natural position within the tree according to the layout algorithm. For any node where the user has not manually adjusted the position, this will be `(0, 0)`; if it is anything else, the layout algorithm will take this into account when determining the final position of the node on the canvas and will also account for it when positioning other nodes relative to it. This allows for manual adjustments to the layout without interfering with the automatic layout logic.

`UnpositionedNode` also includes `label`, which is the label of the node (e.g. "NP", "VP", etc.). This is not strictly necessary for determining the structure of the tree, but it is included here because it is an essential part of the content of any syntax tree and is needed for rendering. In addition, it includes `yAlignMode`, from a planned future addition that allows a node to be aligned with its siblings even when the layout algorithm would normally position it differently. This is currently unused, but it is included in the implementation for the sake of completeness and potential future use.

`UnpositionedNode` has three subclasses: `UnpositionedTerminalNode`, `UnpositionedBranchingNode`, and the interface `UnpositionedStrandedNode`, with further subclasses `UnpositionedPlainStrandedNode`, `UnpositionedFormerlyTerminalNode`, and `UnpositionedFormerlyBranchingNode`.

The former two are the simplest and most common types of node, but both names are a bit at odds with standard linguistic terminology, and I chose them for their relative clarity in the context of this application alone.

**Terminal nodes** in this context are associated with a word, phrase, or part of a word in the sentence, and are positioned to be aligned with that part of the sentence. The way this is implemented is that each terminal node corresponds to a contiguous "slice" of the sentence string, defined by a start and end index. The position of the node is determined by the position of that slice in the rendered sentence. For example: the sentence "The dog barked" would have three terminal nodes, one with slice [0, 3) corresponding to "The", one with slice [4, 7) corresponding to "dog", and one with slice [8, 14) corresponding to "barked".

Terminal nodes have a "triangle" flag, which is used for notating phrase nodes without detailing their internal structure. When this flag is on, the node is rendered with a triangle between its label and its slice, instead of being placed directly on top of the slice.

**Branching nodes** in this context are also somewhat oddly named, since they can have any number of children, including just one. The name was chosen to illustrate the fact that instead of slices, they are associated with child nodes, and their position is determined by the positions of their children. In the sentence above, there might be a branching node that dominates the terminal nodes for "The" and "dog"; its children would be the IDs of those two terminal nodes. Terminal and branching nodes together make up the vast majority of nodes an NPBloom user would encounter.

**Stranded nodes** are used for gaps in the structure of the tree, when a node is not anchored to the rest of the tree in any way (no children or slice) but still has to be rendered somehow. This most commonly happens when a branching node has all of its children removed.

* Formerly-branching nodes are stranded nodes that used to be branching nodes but lost all their children. To maintain their position, they store a copy of the subtree that used to be under them, which is used for layout purposes. This allows them to stay in the same place even after losing their children.
* Plain stranded nodes and formerly-terminal nodes are not currently used in the application, and are only included in the implementation for the sake of completeness and potential future use.

**Why not recursive data structures?** Recursion is inherent to our problem domain, so from a purely algorithmic standpoint it would have been more correct to use a recursive data structure (e.g. a `Node` class that contains a list of child `Node`s). The choice to use flat data structures with IDs instead was made for the following reasons:
* A recursive data structure would be ideal for constructing trees top-down. However, NPBloom is designed to primarily support a bottom-up workflow. For this use case, a recursive data structure would cause more problems than it would solve, since every new addition to the tree would require shuffling around entire subtrees to insert the new node in the right place.
* User interaction with the trees is more complex and "random access" than a simple one-way construction process. Editing nodes, moving them around, changing their relationships, etc. all require a more flexible data structure that allows for efficient access and manipulation of any node at any time.

For a time, NPBloom did actually use a recursive structure for its internal representation. The shortcomings of this approach were quickly revealed, and I rewrote the engine to use a flat data structure instead. If this were a final assignment for CS 101, of course I would have stayed with the recursive solution - that would have been the point of the exercise. However, in the context of real-world software built with humans in mind, it achieves very little beyond intellectual purity while introducing innumerable issues in everything from maintainability to usability.

##### Shapes

Beyond trees, NPBloom also allows inserting arbitrary shapes into the canvas. These are useful, for example, for illustrating relations between trees or highlighting specific nodes for emphasis.

Shapes are implemented as a separate data structure from trees, since they are not part of the tree structure. They are stored per plot, in `UnpositionedPlot.shapes` (an `EntitySet`), alongside the trees in the plot. Shapes can be free-standing, having their own position and dimensions on the canvas and able to be moved and resized freely, or they can be bound to specific nodes, with no independent control over position or size.

Shapes come in two parallel hierarchies, mirroring the split between unpositioned and positioned trees and nodes:
* `PersistentPlotShape`: the form that is stored in an `UnpositionedPlot`, serialized when saving, and changed by content actions.
* `DrawablePlotShape`: the form produced by the positioning pass for a `PositionedPlot` and subsequently rendered on the frontend.

As with trees, conversion only goes one way (persistent → drawable), as part of the positioning pass. Some shapes don't need converting at all: `FreeStandingPlotShape` implements both interfaces, because a shape defined in absolute plot coordinates is already drawable as it is stored. Only free-standing shapes can be resized.

All shape types live in a single file, `content/unpositioned/PlotShape.kt`. This is not a stylistic choice: Kotlin requires subtypes of a sealed type to share its package, and splitting them up would mean giving up the exhaustive `when` checks that sealed types provide. There is a TODO in that file to look for a way around this.

There are two classes of free-standing shapes: `LineShape` and `EnclosureShape`. `LineShape` is a straight line between two points, with an optional arrowhead at one or both ends. `EnclosureShape` is a closed shape defined by a bounding box, with an optional corner radius determining whether it should be drawn as a rectangle (radius = 0), an ellipse (radius = infinity), or a rounded rectangle (radius > 0).

###### Node-bound enclosures

A common use for enclosures is circling or boxing a single node, e.g. when demonstrating garden-path reanalyses. If such an enclosure were free-standing, it would be left behind as soon as the node moved - whether because the user dragged it, the sentence was edited, or the tree was restructured. `NodeBoundEnclosureShape` solves this by anchoring the enclosure to the node itself.

A `NodeBoundEnclosureShape` is a `PersistentPlotShape` but _not_ a `DrawablePlotShape`. It stores its `id`, a `nodeIndicatorInPlot` pointing to its anchor node, a corner radius, and stroke/fill styling, but no position or size; these missing details are only worked out in the positioning pass, based on wherever the anchor node ended up (see the end of the section on the layout algorithm).

The user doesn't choose between free-standing and node-bound enclosures; NPBloom infers it. When the user finishes dragging out an enclosure, `createShapeFromDrag` (in `ui/MouseInteractions.kt`) determines whether it is node-bound or free-standing based on whether there is a single node enclosed in it.

`move()` on a node-bound enclosure is a no-op, since the enclosure moves with its node and has no position of its own to change. Resizing is not possible, since the size is fixed. `ResizeSelectedShape` on a node-bound enclosure is currently a no-op, though this may change in the future.

A node-bound enclosure cannot outlive its anchor. The return value of `UnpositionedPlot.deleteNodes` excludes any enclosure whose anchor is among the deleted nodes, and `deleteTrees` does the same for any enclosure anchored to a deleted tree. A node-bound enclosure can still be selected and deleted by itself, like any other shape.

Future plans for shapes are:
* Adding an "arc" or "curve" shape type. This could be useful for illustrating syntactic movements, for example by drawing a curved line from the trace of a moved constituent to its destination.

#### A note on serialization

The `content` package includes a number of `@Serializable` classes. In almost all of them, the fields are all marked with `@SerialName` with a single-character name. This is part of the saving and loading logic, which uses the `kotlinx.serialization` library to serialize the data into CBOR. The single-character names are used to minimize the size of the serialized data, which is already quite small thanks to the compact nature of CBOR.

#### The layout algorithm

The central classes for the layout algorithm are `PositionedPlot`, `PositionedTree`, and the subclasses of `PositionedNode`. These classes are similar to their unpositioned counterparts, with the following differences:

* Instead of `offset: TreeCoordsOffset`, they have `position: CoordsInTree`. This is the actual position of the node within the tree, taking into account any adjustments made by the user.
* Instead of `triangle` being a boolean flag on terminal nodes, it is a `TreeXRange`, denoting the range of X positions that the triangle occupies. These are not indices within the sentence string, but actual visual coordinates on the canvas. This helps the renderer know how big the triangle should be and where it should be positioned, without having to do any additional calculations based on the sentence string.
* There is only one `PositionedStrandedNode` with no information on former slice or descendants. Since the three types of stranded nodes are only distinguished for layout purposes, they can be collapsed into one once the layout algorithm has been applied.

The entire layout algorithm is implemented in `content/positioned/Positioning.kt`. The entry point is the `applyNodePositionsToPlot` function, which takes an `UnpositionedPlot` and returns a `PositionedPlot` with the positions of all nodes calculated.

The heart of the algorithm is the recursive `applyNodePositions` function, which the `applyNodePositionsToPlot` function calls for each tree in the plot. This function takes an `EntitySet<UnpositionedNode>` representing the nodes to be positioned and the `UnpositionedTree` they belong to, and returns an `EntitySet<PositionedNode>` with the positions of all nodes calculated.

The algorithm first works out which of the nodes to be positioned can be positioned based on the information available. At first, these are:
* Terminal nodes, whose positions are determined only by their slices and the sentence string.
* Stranded nodes, which internally store their former slices or subtrees for layout purposes, so they can be positioned based on that information.
* Branching nodes that have been "folded" by the user, which means they are temporarily treated as terminal nodes with triangles, so they can be positioned based on the combined slice of all their descendants.

The algorithm then applies the layout logic: each node is positioned in the middle of its (stored or derived) slice. The unpositioned nodes are then converted to positioned nodes with the calculated positions. The function is then called recursively with the remaining unpositioned nodes and the new positioned nodes.

In subsequent calls, branching nodes whose children have all been positioned can also be positioned. This is also fairly unsophisticated: the X position of a branching node is the average of the X positions of its children, and its Y position is a set distance above the child with the minimum (i.e. highest) Y position.

This process continues until the set of nodes to position is empty. At this point the set of already-positioned nodes is returned as the final result.

If you've been reading the code as you go, you may have noticed the elephant in the room I've been avoiding: `strWidthFunc`. The layout algorithm needs to know the width of each slice in the sentence in order to position the nodes correctly, which means it needs to be able to call a function to measure the width of a string in pixels. Since `npbloom-core` is platform-agnostic and does not contain any graphics code, it can only take this as a function injected from the frontend. This is an example of the design philosophy behind `npbloom-core`, allowing the frontend to inject any necessary platform-specific logic while keeping the core logic independent and reusable.

##### Positioning shapes

Once all the trees in a plot have been positioned, `applyNodePositionsToPlot` runs each of the plot's shapes through `applyPositionToShape`, which turns a `PersistentPlotShape` into a `DrawablePlotShape`. Free-standing shapes are returned as-is. Node-bound enclosures are resolved into a `ResolvedNodeBoundEnclosureShape`, now with explicit positions and dimensions.

The resolved position of a node-bound enclosure is deliberately split into two components: `anchorPlotX`/`anchorPlotY`, which is the position of the anchor _tree_ in the plot, and `treeX`/`treeY`, which is the position of the enclosure relative to that tree. (Width and height are stored separately.) Adding the two gives the enclosure's absolute position in the plot, which is all that the main plot view needs. Keeping them separate helps consumers that work in tree-local coordinates, such as single-tree export: they can drop the anchor and use the in-tree position directly, without having to know anything about the tree's position or the current pan/zoom state.

`PositionedPlot.positionShape` exposes the same conversion for a shape that isn't part of the plot (yet). The frontend uses this to render the preview while a shape is being drawn, so the preview snaps around a node as soon as the drag would create a node-bound enclosure, giving the user an indication of what's about to happen.

#### The rest of the `content` package

The `content` package includes a few utility classes and functions that I won't go into detail about here. It also includes some logic for converting between NPBloom trees and other formats; currently this is limited to labelled bracket notation, but I plan to add support for other formats in the future. This is the only place in the codebase where recursive data structures _are_ used to represent trees, since they are not directly human-facing and are only used as part of algorithms.

### `history` package

The heart of the history system is a single generic class, `UndoRedoHistory<S, A>`, where `S` represents a state and `A` represents an action. It contains the following fields:
* `current: S` - the current state.
* `undoStack` and `redoStack` - lists of `A`, representing the undo and redo stacks respectively, stored with the most recent action first.
* `applyActionFunc: (S, A) -> S` - an injected function that takes a state and an action and returns the new state that results from applying the action to the state.
* `reverseActionFunc: (A) -> A` - an injected function that takes an action and returns the corresponding action that would reverse it.

The key constraint is that actions on the undo stack must be **reversible**: for any action that can be applied, there must be a corresponding action that undoes it. `UndoRedoHistory` does not prescribe how this reversibility is achieved; it is left to the caller to provide the `reverseActionFunc`. This keeps the class generic and reusable.

The three core operations are:
* `applyAction(action)`: applies the action to the current state, pushes it onto the undo stack, and clears the redo stack (since the redo history is invalidated by any new action).
* `undo()`: takes the top action from the undo stack, reverses it, applies the reversed action to the current state, and moves the original action to the redo stack.
* `redo()`: takes the top action from the redo stack, applies it to the current state, and moves it back to the undo stack.

The way this system is used is by translating high-level user actions (e.g. "insert this node", "delete this node", "move this node") into low-level reversible changes that capture both the old and new states (e.g. "the tree changed from X to Y" or "a tree with this content was added/deleted"). This translation is done in the `ui` package, which defines the possible user interactions and how they affect the state of the application. The `contentReducer` function in the `ui` package is responsible for handling this translation and applying the resulting changes to the undo/redo history.

The `history` package is designed to be completely independent of the specific content and actions of the application, and can be reused in any context where undo/redo functionality is needed. It is important to have at least a basic conceptual understanding of this system in order to effectively implement any user interactions, since all changes to the state of the application must go through this system in order to be undoable and redoable.

With that out of the way, we can move on to the `ui` package, which makes heavy use of the history system to bridge the frontend and the core logic.

### `ui` package

The `ui` package defines what user interactions exist in the application and how they affect the state of the application. It is platform-agnostic and does not contain any actual UI code, but it defines the logic for how the application should behave in response to user actions.

A repeating theme here is actions as objects. The UI dispatches actions to a reducer, which translates them into undoable state changes and applies them to the history.

The package includes its own `content` package, which connects the UI actions to the content structures discussed earlier. The star here is `ContentState.kt`.

#### How `ContentState.kt` works

There are two layers of actions:

* **`ContentAction`**: Intent-based actions dispatched by the UI - e.g. `InsertNode`, `DeleteNodes`, `SetSentence`, `MoveNodes`. These describe _what the user did_, not what state change resulted from it.
  - `ContentAction` extends `ContentOrHistoryAction`, which is a sealed interface that also includes `Undo` and `Redo`. This allows the same reducer to handle both content actions and undo/redo actions; it can dispatch `Undo` and `Redo` directly to the undo/redo history, while translating any `ContentAction` into a `ContentChange` before applying it to the state. (`Undo` and `Redo` obviously don't need to be undoable/redoable themselves, which is why they are in a different place in the class hierarchy. The UI dispatches a `ContentOrHistoryAction`, but only `ContentAction`s need to be on the stack.)

* **`ContentChange`**: Lower-level state changes that explicitly capture both the old and new states - e.g. "the tree with this ID was changed from X to Y". Since these capture all the information about the old and new states, this is the form that actions take on the undo stack, as the `A` type parameter in `UndoRedoHistory<S, A>`.

The bridge between the two layers is the `makeUndoable(state, action)` function, which converts a `ContentAction` to a `ContentChange` by computing and capturing the resulting state. For example, `InsertNode` becomes `TreeChanged` with both the old tree and the new tree (with the node inserted) stored in it. This conversion is what makes the undo/redo system work, since reversing a `ContentChange` is trivial.

The entry point is `contentReducer`, which handles `ContentOrHistoryAction`: dispatching `Undo` and `Redo` directly to `state.undo()` and `state.redo()`, and converting any `ContentAction` to a `ContentChange` via `makeUndoable` before calling `state.applyAction`.

#### The rest of `ui.content`

**`EditNodes.kt`**: A supplement to `content/unpositioned/Manipulation.kt` with some routines that facilitate better UX in addition to the fundamental tree manipulation logic in the other package. Two main functionalities are implemented here: (a) adjusting terminal node slices when words are added or removed, and (b) guessing user intent when inserting nodes based on their current selection.

**`SaveLoad.kt`**: Logic for saving and loading files locally on the user's device. The serialized unit is `FileContents` (defined in `FileContents.kt`), which packages a `ContentState` together with the per-plot pan/zoom states. `FileContents` is encoded into CBOR using `kotlinx.serialization`, then prefixed with a magic number and a format version byte-pair.
  - Files from format versions 1.x stored only a bare `ContentState` and are handled by wrapping the decoded object in a `FileContents` with empty pan/zoom state.
  - This file is only responsible for saving and loading in NPBloom's native format; labelled bracket notation export and import are handled in `content`.

**`AutoFormat.kt`**: A simple routine for formatting subscripts in node labels and sentences. For example, "NP[1]" would be automatically converted to "NP₁", and "Mary[i]" would be converted to "Maryᵢ". This is purely a cosmetic feature, but it adds a nice touch of polish to the output and is easy to implement.

#### How `UiState.kt` works

The content state management described above is one part of the greater UI state, which is implemented according to the same principles. `UiState` defines a set of actions that is even higher-level than the ones in `ContentState`, with the key difference being that the UI state also includes information about the current selection, view settings, and other UI-related state that is not directly related to the content of the trees.

Similarly to how content _actions_ are defined in higher-level terms than content _changes_, UI actions are defined in even higher-level terms than that, reflecting as closely as possible the actual user interactions that trigger them. For example, while a content action may be "delete the nodes with these IDs", a UI action would be "delete the currently selected nodes", referring to UI state outside the content.

Similarly to `contentReducer`, there is a `uiReducer` function that takes a `UiAction` and applies it to the `UiState`, which includes dispatching any resulting `ContentAction`s to the `contentReducer`. Many `UiAction`s are just wrappers around `ContentAction`s, but some of them also include additional logic for updating the selection or view settings in response to the content changes.

For example, when the selected nodes are deleted, the selection has to change accordingly since the previously selected nodes no longer exist. Here's a slightly simplified example of how this system facilitates this:

1. The frontend dispatches `DeleteSelectedNodes`, an object implementing `UiAction`, to the `uiReducer`.
2. The `uiReducer` checks the current selection state to determine which nodes should be deleted. It then dispatches a `DeleteNodes` action to the `contentReducer` with the IDs of those nodes.
3. The `contentReducer` translates `DeleteNodes` into a `ContentChange` that captures the old and new states of the affected trees, and applies it to the undo/redo history.
4. The `uiReducer` then determines what the new selection state should be after the deletion (e.g. selecting the children of the deleted nodes, or the slice of the sentence that was previously covered by the deleted nodes), and updates the selection state accordingly.
5. The `uiReducer` aggregates these changes into a single new `UiState` that includes the new selection state and the new content state along with its updated history. It then returns this new `UiState` to be sent back to the frontend.

The subclasses of `UiAction` are directly exposed to the frontend, acting as the main entry point into `npbloom-core`. The frontend dispatches these actions in response to user interactions (e.g. clicking a button, pressing a keyboard shortcut, etc.), and only needs to know about these user interactions as an abstract concept; the core logic of how those interactions affect the content is encapsulated within `npbloom-core`.

#### The coordinate system(s)

Coordinates in NPBloom can be defined relative to one of three frames of reference: **plot**, **tree**, and **client**. It is important to understand which one is in use at any given time, since they are used in different contexts and have different meanings.

Each coordinate system is represented by its own set of types:

* **Tree coordinates** (`CoordsInTree`, with components `TreeX` and `TreeY`) describe positions within an individual tree, relative to the tree's origin. The origin of a tree is at the left edge of its sentence, at the top of the sentence text. In this space, X increases to the right and Y increases downward (negative Y values are above the sentence, where nodes live). Node positions are expressed in tree coordinates, and the positioning algorithm (described above) determines them based on the sentence text and the tree structure.

* **Plot coordinates** (`CoordsInPlot`, with components `PlotX` and `PlotY`) describe positions on the canvas as a whole. Each tree has a position in plot coordinates, which determines where its origin sits on the canvas. Plot coordinates are stable - they do not change when the user pans or zooms the view, only when the tree itself moves. To get the absolute position of a node on the canvas, add the node's tree coordinates to its tree's plot coordinates. The utility function `calculateNodeCenterOnPlot` does exactly this, while also adjusting for the distance between a node's bottom edge and its visual center.

* **Client coordinates** (`CoordsInClient`, with components `ClientX` and `ClientY`) describe positions on screen relative to the top-left corner of the viewport. These are the coordinates that the user interacts with directly: mouse events arrive in client coordinates. Client coordinates change as the user pans and zooms, even if the underlying plot and tree coordinates remain the same.

The relationship between these spaces is mediated by the **pan/zoom state** (`PanZoomState`), which consists of two values:
* `viewPositionInPlot`: a `PlotCoordsOffset` representing the plot coordinate that currently appears at the top-left corner of the viewport.
* `zoomLevel`: a `Double` scale factor (clamped to the range 0.1–10.0) by which the canvas is magnified.

##### Storing pan and zoom state

Each plot has its own independent `PanZoomState`. `UiState` stores them as `plotPanZoomStates: List<PanZoomState>`, one entry per plot, indexed by plot index. The active plot's state is exposed as a computed property `panZoomState` for convenience.

At first glance, this seems a bit roundabout. This design decision had to balance three factors:
1. Each plot should have its own pan/zoom state, independent of the other plots.
2. Pan/zoom state should be preserved when saving and loading files.
3. Pan/zoom state is a UI concern, not a content concern, since it is not related to the structure or content of the trees in any way.

(1) and (2) alone imply we would want to store pan/zoom state under `UnpositionedPlot`, since that is the main data structure for each plot, which gets serialized and deserialized when saving. However, that would violate (3) - we don't want to mix UI state with content state.

To avoid this, we store pan/zoom state separately in `UiState`, but we still include it in the serialized file format by packaging it together with the content state in `FileContents`. This way, we keep pan/zoom state separate from content state in the codebase, while still preserving it across save/load.

##### Converting between plot and client coordinates

To convert a point from client to plot coordinates, divide by the zoom level and add the view position:
```
plotX = clientX / zoomLevel + viewPositionInPlot.dPlotX
plotY = clientY / zoomLevel + viewPositionInPlot.dPlotY
```

To convert in the other direction, subtract the view position and multiply by the zoom level:
```
clientX = (plotX - viewPositionInPlot.dPlotX) * zoomLevel
clientY = (plotY - viewPositionInPlot.dPlotY) * zoomLevel
```

These conversions are implemented as methods on `CoordsInClient` and `CoordsInPlot` respectively, both taking a `PanZoomState` parameter. Equivalent conversions exist for offsets (`ClientCoordsOffset` ↔ `PlotCoordsOffset`) and for rectangles (`RectInClient` → `RectInPlot`).

##### Offsets vs. absolute coordinates

Each coordinate space has both an absolute type and an offset type. The absolute types (`CoordsInPlot`, `CoordsInTree`, `CoordsInClient`) represent specific positions, while the offset types (`PlotCoordsOffset`, `TreeCoordsOffset`, `ClientCoordsOffset`) represent displacements, i.e. the difference between two positions. Offset types live in the `content.unpositioned` package (for `PlotCoordsOffset` and `TreeCoordsOffset`) and in the `ui` package (for `ClientCoordsOffset`), reflecting where they are most commonly used. Every unpositioned node stores a `TreeCoordsOffset` called `offset` that represents a user-applied adjustment to the node's natural position (defaulting to zero). Similarly, each tree's position on the plot is a `CoordsInPlot` that can be adjusted by a `PlotCoordsOffset`.

##### Panning and zooming

When the user pans, a `ClientCoordsOffset` representing the mouse drag distance is converted to a `PlotCoordsOffset` (by dividing by the zoom level), and that offset is subtracted from `viewPositionInPlot`. Subtraction is used because dragging the mouse to the right moves the viewport origin to the left in plot space, revealing content further to the left.

When the user zooms, the zoom is focused around a point (typically the mouse cursor). The `zoomBy` method adjusts both the zoom level and the view position so that the plot coordinate under the focus point remains under the focus point after the zoom. This is achieved by converting the focus point to plot space, computing the new zoom level, and then solving for the new view position that keeps the focus invariant.

##### Rendering trees and handling interactions

The frontend should render each tree as a group that is translated to the tree's plot position (converted to client coordinates) and scaled by the zoom level. This means that within the group, all coordinates are in tree space and are automatically transformed to the correct screen position by the group's transform. Nodes, edges, and other tree-internal elements can use their tree coordinates directly.

Elements that float outside the tree groups, such as sentence text input fields or node label editors, need to position themselves in client coordinates manually, using the conversion functions described above.

When the user drags nodes or trees, the frontend should compute the drag offset in the target coordinate space - tree coordinates for nodes, plot coordinates for trees - and dispatch a `MoveSelectedNodes` or `MoveSelectedTrees` action with those values. The `dx` and `dy` parameters of these actions are plain `Double` values that the core wraps as `TreeCoordsOffset` or `PlotCoordsOffset` respectively, so they must already be in the correct space. If the frontend captures drag distances in client pixels, it is the frontend's responsibility to divide by the zoom level before dispatching.

#### `SettingsState.kt` and user settings

Any frontend for NPBloom is expected to include a settings menu, allowing the user to customize various aspects of the application. For now these are limited to the string width measurement method and some auto-formatting options, but I plan to add more settings in the future.

Managing the state for these settings is the responsibility of `SettingsState`, which works in parallel to `UiState` and is designed according to the same principles. Changes to the settings are applied via actions that implement `SettingsAction`, which are dispatched to a `settingsReducer` function that updates the state accordingly. The settings state is then used by the frontend to determine how to apply the relevant settings (e.g. which string width measurement method to use in the layout algorithm, whether to apply auto-formatting when inserting nodes, etc.).

#### The rest of the `ui` package

**`Selection.kt`**: Logic for managing the current selection, which can consist of nodes, trees, or a slice. The UI state manager refers to this to determine what is currently selected, and updates it in response to user interactions. The selection state is also used by the frontend to determine what to highlight on the canvas and what operations are available to the user at any given time.

**`MouseInteraction.kt`**: Logic for handling various mouse interactions, such as clicking, dragging objects, and making selection boxes. This mostly consists of determining what the user is interacting with and what actions should be triggered in response. These functions are called by the frontend in response to mouse events, with the relevant coordinates and other information passed in as parameters.

**`Coords.kt`**: A supplement to `CoordsInPlot` and `CoordsInTree` from `content`, concerning coordinates more directly related to the UI than to the content itself. These include client coordinates (relative to the viewport) and rectangles (used for selection boxes and similar features). This file also includes some utility functions for converting between different coordinate systems, which are used throughout the frontend.

**`PanZoomState.kt`**: Encapsulates the state related to panning and zooming around the canvas. This functionality is why the aforementioned conversion functions are necessary, since the positions of nodes and trees are defined in terms of plot coordinates, but the user interacts with them in terms of client coordinates.

**`NodeCreationTrigger.kt`**: Defines where a user is able to click to quickly add a new node. These triggers are invisible by default, and only become visible when the user hovers over the relevant area, as if suggesting the next move to the user based on their mouse position. This is a small but important part of the user experience, since it allows for a more fluid workflow when building trees. These triggers are placed in the following locations:
* Above each word in the sentence. Example: click above "The" to create a node for it, click above "dog" to create a node for it, etc.
* Above the selected slice, if there is one. Example: select the phrase "The dog" and click above the selection to create a node for the entire phrase. (If a slice is selected, words that overlap with it will not have their own triggers.)
* Above any node without a parent. Example: click above "N" to create a new "NP" node dominating it.
* Between each pair of adjacent nodes without parents. Example: click above the space between "V" and "NP" to create a new "VP" node dominating both of them.

Currently, node creation triggers are rather basic and all have the same shape and size, a simple square centered on the relevant location. In the future, I plan to use a radius-limited Voronoi diagram to prevent the triggers from overlapping even in dense areas.

### Tests for `npbloom-core`

The `npbloom-core` library includes a few hundred tests covering the core logic of the application, including tree manipulation, layout, and state management. These tests are implemented using `kotlin.test` and are located in the `commonTest` directory of the `npbloom-core` module. The Gradle tasks `jvmTest` and `jsTest` can be used to run the tests on the JVM and JS platforms respectively.

### Building `npbloom-core` for use in `npbloom-web`

Building `npbloom-core` with the `build` Gradle task outputs a JavaScript library with TypeScript type declarations. For `npbloom-web` development, I have been using the `npbloom-core/build/dist/js/productionLibrary` output, using `npm link` to allow importing it as a dependency in the `npbloom-web` project.

Kotlin/JS is still somewhat rough around the edges, especially in the TypeScript interop department. The `build` task is finalized with a custom task `patchKotlinJsBugs`, defined in `build.gradle.kts`, that applies some manual patches to the generated output. Note also that changing the Kotlin code will not automatically trigger a rebuild of the JS library, so you will need to run `build` again after making changes to `npbloom-core` in order for them to be reflected in `npbloom-web`.

## `npbloom-web`

The `npbloom-web` application uses `npbloom-core` for all the underlying logic related to tree manipulation and state management, while implementing the UI and rendering logic in TypeScript. Rendering is done using plain SVG, without any external libraries, to allow for maximum control and customization.

The central component is `components/PlotView.tsx`, which contains the root `<svg>` element on which the trees are rendered. Each tree is rendered as a `TreeView`, containing a `<g>` element that includes all nodes in the tree, and a `SentenceView`, which is made up of a single `<input>` element for the entire sentence. This is so the sentence can be fully written out first like a normal sentence, and then the tree can be built up from it. `TreeView` itself is responsible for rendering the nodes and edges of the tree, as well as handling interactions with them (e.g. clicking to select a node, dragging to move it, etc.).

### The bridge to `npbloom-core`

Building `npbloom-core` outputs a JavaScript library with TypeScript type declarations, which is imported into `npbloom-web` as a dependency. As explained in the section on building `npbloom-core`, the generated output can be linked into the `npbloom-web` project using `npm link`, allowing it to be imported as a regular dependency in the TypeScript code.

In terms of numbers alone, most of the imports from `npbloom-core` are action classes and state management logic from the `ui` package, which again act as the primary bridge between the frontend and the core logic. These are supplemented by a number of types and utility functions from both the `content` and `ui` packages, such as coordinate types, selection logic, and so on.

### Environment setup

The `npbloom-web` application is built using [Vite](https://vitejs.dev/). To set up the development environment after building `npbloom-core`, run the following commands from the root of the project:

```bash
cd npbloom-web
npm install
npm link ../npbloom-core/build/dist/js/productionLibrary
npm run dev
```

The development server should promptly start up. Any changes you make to the TypeScript code in `npbloom-web` will be hot-reloaded automatically. However, as mentioned earlier, changes to the Kotlin code in `npbloom-core` will require you to run the `build` Gradle task again in order for them to be reflected in the JS library that `npbloom-web` depends on.

The top-level React component is `App.tsx`, which sets up state management (described in more detail below). The main UI is rendered under it in `UiRoot.tsx`, which is the root of the entire application's UI.

### Finding your way around

The `components` directory contains all the React components that make up the UI. The main ones are:
* `PlotView.tsx`: The main component responsible for rendering the plot and all the trees on it, as well as handling interactions with them.
* `MainMenu.tsx`: The main menu at the top of the screen, containing options for file I/O and some view settings.
* `Toolbox.tsx`: The toolbox on the left side of the screen, containing operations for manipulating the tree (e.g. adding nodes, changing relationships, etc.).
* `PlotSelector.tsx`: The plot selector at the top of the screen, allowing the user to switch between different plots, create new ones, and delete existing ones.
* `ZoomMenu.tsx`: The zoom menu floating near the bottom right corner of the screen, allowing the user to choose different zoom levels.

`io` contains logic for transferring data outside the current session or from other applications. This will be discussed in depth in the dedicated section on file I/O.

`strWidth` contains two different implementations of the string width measurement function, which is crucial for the layout algorithm. This will also be discussed in more detail in the corresponding section.

### State management in `npbloom-web`

The state manager described in `UiState.kt` above is directly used as part of a React context in `npbloom-web`, which allows the entire component tree to access the current state and dispatch actions to update it. The `UiStateContext.Provider` component wraps the entire application, providing the state context to all components.

Inside any component, the `useUiState` hook can be used to access the current state and dispatch function, allowing components to read from the state and dispatch actions in response to user interactions. `dispatch` in turn takes one of the `UiAction`s imported from `npbloom-core` and applies it to the state via the `uiReducer`, which may also dispatch `ContentAction`s to the `contentReducer` as part of its logic, which in turn applies changes to the undo/redo history. For example:

```javascript
import { useUiState } from '../state/UiStateContext';
import { DeletePlot } from 'npbloom-core';

// Hook into the UI state context to get the current state and dispatch function
const { state, dispatch } = useUiState();

// The "delete plot" handler takes a plot index and dispatches a DeletePlot action to the reducer
const deletePlot = (plotIndex: PlotIndex) => dispatch(new DeletePlot(plotIndex));
```

In addition to the UI state, the settings state from `SettingsState.kt` is also used in a similar way, with its own context and provider. This allows components to access user settings and preferences as needed.

### `PlotView` and its child components

The `PlotView` component is responsible for rendering the entire plot, including all trees and their sentences, covering the entire screen except for the main menu, toolbox, and plot selector. It uses the current state as described above to determine what to render and how to render it, and also dispatches actions in response to user interactions with the plot (e.g. clicking on a node, dragging a tree, etc.).

`PlotView` contains components of the following kinds:
* `TreeView`: Responsible for rendering a single tree, including its nodes and edges, and handling interactions with them. Internally, it receives a `PositionedTree` derived from the state.
* `SentenceView`: An editable text input for the sentence corresponding to a tree. It is rendered below the tree and allows the user to edit the sentence directly.
* `LabelNodeEditor`: If a node label is being edited, this component renders a text input for editing the label directly on the canvas, positioned on top of the node.

`PlotView` itself manages:
* Creating a new tree by clicking on an empty area of the plot
* Selection boxes for selecting multiple nodes or trees at once
* Panning and zooming around the canvas

#### Selection

The selection system on the frontend is designed to work with the selection state in `Selection.kt`. As in the core logic, the selection can consist of nodes, trees, or a slice.

By default, clicking on a node selects it. Holding Alt or clicking on "Select trees" in the toolbox switches to tree selection mode, where clicking anywhere within a tree selects the entire tree. In either mode, Ctrl+clicking allows for multi-selection, while clicking without Ctrl replaces the current selection with the new one. Clicking on an empty area of the plot deselects everything.

When a slice of the sentence is selected, the application has to keep the selection state inside the text input (which is uncontrolled) in sync with the selection state in `Selection.kt`. This is done by listening for selection changes on the text input and dispatching a `SetSelectedSlice` action to update the selection state accordingly. Conversely, when the selection state changes to a slice selection, the application updates the text input's selection to match it.

Selection state is represented by objects imported from `npbloom-core`: `NodeSelectionInPlot`, `TreeSelectionInPlot`, `SliceSelectionInPlot`, and `NoSelectionInPlot`. These are used by the frontend to determine what to highlight on the canvas and what operations are available to the user at any given time. For example, if a node is selected, the frontend can highlight that node and enable operations like "delete node", "add parent node", etc.

`NodeSelectionInPlot` and `TreeSelectionInPlot` include the IDs of the selected nodes/trees as a set that must contain at least one element. If either of these sets is empty, the selection must be switched to `NoSelectionInPlot`; this constraint is enforced in `npbloom-core` and the frontend is designed to crash if it is violated. This is a deliberate design choice since it means an empty selection can only be represented with one state.

#### Mouse interaction state machine

The primary mode of interaction with `PlotView` is with the mouse. Since this interaction can take multiple forms, the application manages which gesture the user is currently performing with a mouse interaction state machine, implemented in the `usePlotMouseInteractions` hook on the frontend and `MouseInteraction.kt` in `npbloom-core`. The states include:
* `idle`: The default state when the user is not performing any mouse interactions.
* `selecting`: When the user is clicking and dragging to create a selection box for selecting multiple nodes or trees.
* `panning`: When the user is Shift+clicking and dragging on an empty area of the plot to pan around.
* `draggingNodes`, `draggingTrees`, `draggingShapes`: When the user is clicking and dragging nodes, trees, or shapes to move them around.
* `resizingShape`: When the user is clicking and dragging the edges of a shape to resize it.

Since dragging is a repeating theme here, `dragStartCoords` and `dragEndCoords` are used across all drag modes to keep track of the starting and current coordinates of the drag action. How these are used depends on the specific gesture being performed. In node/tree dragging modes, the generic `dragOffset` is used to determine how far the objects should be moved, while selection mode uses the more specialized `selectionBoxTopLeft` and `selectionBoxBottomRight` derived from these coordinates to render the selection box.

`mouseInteractionMode` enters a state other than `Idle` whenever the primary mouse button is pressed down on a node, a tree, a shape, or a blank area of the plot.

* If the user clicks on a node, `mouseInteractionMode` becomes `DraggingNodes`, and the user can drag the node around to move it. The same applies to trees and shapes, with `DraggingTrees` and `DraggingShapes` respectively.
* If the user clicks on an empty area of the plot, `mouseInteractionMode` depends on whether the Shift key is held down:
  - If Shift is held down, `mouseInteractionMode` becomes `Panning`, and the user can drag to pan around the plot.
  - If Shift is not held down, `mouseInteractionMode` becomes `Selecting`, and the user can drag to create a selection box for selecting multiple nodes or trees.

In all cases, `mouseInteractionMode` returns to `Idle` when the primary mouse button is released, and the corresponding `UiAction` is dispatched (e.g. moving the dragged nodes/trees, selecting the nodes/trees within the selection box, etc.).

If the user clicks on a text input element - `SentenceView` or `LabelNodeEditor` - the mouse interaction state machine does not apply, since the user is interacting with the text input rather than the plot. `PlotView` will simply not capture these events, instead letting the text inputs handle them as normal. However, interacting with `SentenceView` will fire events that update the selection state to `SliceSelectionInPlot`.

#### Other `PlotView` internals

`PlotView` also handles scroll events for panning and zooming. On mice with a scroll wheel:
* Scrolling up and down pans the plot vertically.
* Holding Shift while scrolling pans the plot horizontally.
* Holding Ctrl/Cmd while scrolling zooms the plot in and out, centered on the mouse position.

On devices with a trackpad:
* Two-finger scrolling pans the plot in all directions.
* Pinching with two fingers zooms the plot in and out, centered on the current position of the cursor.

Finally, another event that `PlotView` handles directly is dropping labelled bracket notation onto the plot. When the user drags and drops a bit of text from any other application onto the plot, if that text happens to be labelled bracket notation, NPBloom will parse it and create a new tree with the corresponding structure where the text was dropped. This is a small but nice feature that allows for easy import of trees from other sources.

`PlotView` returns a bunch of elements to be rendered in the main UI: besides the SVG containing the plot itself, it is also responsible for the `SentenceView` elements (not part of the SVG since they are HTML inputs), any `LabelNodeEditor` that may be active, and the trigger for the zoom menu (see below).

#### `TreeView`

A direct descendant of `PlotView`, `TreeView` is responsible for rendering a single tree, including its nodes and edges, and handling interactions with them. It receives a `PositionedTree` from its parent `PlotView`, which includes all the information about the tree's structure and the positions of its nodes.

The most important bit of functionality in `TreeView` is `renderNode`, which takes a `PositionedNode` and renders it as an SVG element on the canvas. This includes rendering the node's label, its edges to its children, and any interaction handlers for clicking, dragging, etc.

`TreeView` is also responsible for rendering the triggers for adding new nodes. These correspond to the `NodeCreationTrigger`s defined in `NodeCreationTrigger.kt`, and are rendered as invisible areas that become visible when the user hovers over them, allowing for quick addition of new nodes in the relevant locations.

Finally, `TreeView` renders a box around the entire tree when it is selected, which is done by calculating the bounding box of all nodes in the tree and rendering a rectangle around it.

`TreeView` is _not_ responsible for rendering the sentence; that is the job of `SentenceView`, which is rendered separately below the tree. This allows the sentence to be edited directly as text.

#### `ShapeView`

`ShapeView` is the equivalent of `TreeView` for shapes, which are the lines, arrows, and enclosures that users can create to annotate the plot. It is responsible for rendering these shapes and connecting them to the mouse interaction system for dragging and resizing. Since shapes are not part of the tree structure, they are rendered directly within `PlotView` rather than within `TreeView` (this extends to node-bo). They also have their own selection logic, separate from the node and tree selection, which is handled by `ShapeView`.

`ShapeView` receives a `DrawablePlotShape` from the positioned plot and dispatches it to one of three render functions: `renderLine` (in `shapes/lines.tsx`), or `renderFreeStandingEnclosure` or `renderNodeBoundEnclosure` (in `shapes/enclosures.tsx`). Both enclosure renderers draw the shape itself with `renderBaseEnclosure`. Its position and size parameters are deliberately plain numbers with no specified coordinate system (plot/tree/client): it only writes them into SVG attributes, and what they mean depends on the transform of the group the caller places the result in. Free-standing enclosures pass client coordinates, while node-bound enclosures pass tree coordinates (see below). The typed coordinates live in the callers, which are where the conversions between spaces happen. Each shape is wrapped in a `<g>` with the ID `shape-<id>`, which is how single-tree export finds it.

The rendering logic for free-standing shapes consists of five parts:
* The visual representation of the shape itself: a line, a rectangle, or an ellipse, based on the shape's properties.
* A thick, invisible border around the shape that serves as the trigger for dragging the shape around. This is necessary since thin borders can be hard to click on, especially when the shape is small.
* Small squares ("handles") that serve as triggers for resizing the shape. For lines, these are shown at the endpoints; for enclosures, they are shown at the corners and midpoints of the edges. These are only visible when the shape is selected, and they allow the user to click and drag to resize the shape in different directions.
* A ghost for the shape that appears when the user is dragging it, showing where the shape will be dropped if the user releases the mouse button at that moment.
* A ghost for the shape that appears when the user is resizing it by dragging one of the handles, showing the new dimensions of the shape as it is being resized.

The mouse dragging behavior for shapes is implemented in the `usePlotMouseInteractions` hook, similarly to the dragging behavior for nodes and trees. When the user clicks and drags on a shape, the hook updates the `mouseInteractionMode` to `DraggingShapes`, and the corresponding `UiAction` is dispatched when the mouse button is released to apply the change to the state. A similar process applies to resizing shapes by dragging the handles.

Node-bound enclosures are rendered differently. The visual part is drawn in tree coordinates, inside a `<g>` with exactly the same transform as the anchor tree's group in `TreeView`: `translate(...)` to the tree's position in client coordinates, then `scale(zoomLevel)`. This mirrors the two-component position of `ResolvedNodeBoundEnclosureShape` described in the section on positioning shapes. Sharing the tree's transform means the enclosure lines up with its node at any zoom level, and that single-tree export can strip the transform from both and have them still line up. It also means the visual is not pixel-snapped, since it must render exactly like the tree it belongs to.

The hit area and handles, on the other hand, have fixed on-screen sizes regardless of zoom level, which a scaled group would distort. They are drawn outside the scaled layer, in client coordinates computed the same way as for free-standing enclosures. As they are not marked for export, they never affect the exported image.

Beyond that, node-bound enclosures differ from free-standing ones in a few ways:
* Clicking selects them as usual, but `handleShapeMouseDown` doesn't start a drag, since they can't be moved directly. Consequently, they have no move ghost.
* Handles are rendered when the enclosure is selected, but only as a selection indicator; their mouse handler does nothing, and there is no resize ghost.
* The visual layer is marked with `data-npb-export`, so it is included in single-tree export. (Free-standing shapes do not need this since they are plot-level entities excluded from tree-level export.)

### Main menu, toolbox, and other UI components

Besides the plot and tree views, the main menu and toolbox are the other primary means of interacting with the content. The main menu (`components/MainMenu.tsx`) contains options for file I/O and some view options, while the toolbox (`components/Toolbox.tsx`) contains mostly operations for manipulating the tree (e.g. adding nodes, changing relationships, etc.).

Most actions in the menu and on the toolbox are associated with keyboard shortcuts, which are implemented using the `useHotkeys` hook.

The plot selector allows the user to switch between different plots in the same forest. It is implemented as a simple toolbar that lists the current plots, allowing the user to switch between them, create new ones, and delete existing ones.

Finally, the zoom menu is a small component that appears as a button floating near the bottom right corner of the screen. When clicked, it opens a menu offering different zoom levels to choose from.

#### End-to-end guide to adding a new user interaction

Because of the multiple layers of abstraction between the frontend and the core logic, adding a new user interaction is a bit of an involved process. Below is a high-level overview of the steps involved. The steps can be completed in any order, but the process described below will be based on the assumption that you are starting from the core content logic and working your way out towards the frontend.

1. Define the new interaction as a `ContentAction` in `ContentState.kt`, describing the user's intent in **content-level** terms. What this means is that the action should be defined in terms of what the user is trying to achieve with the content, without any reference to the UI or how the user is interacting with it. For example, if the new interaction is "duplicate a node", the `ContentAction` might be `DuplicateNode(nodeId: NodeId)`, which simply describes the intent to duplicate a node with a given ID.
2. Define the low-level state change that results from this action under the `makeUndoable` function in `ContentState.kt`, describing the actual change to the content in terms of old and new states. For example, `DuplicateNode` might result in a `ContentChange` that captures the old tree and the new tree with the duplicated node added to it. This is the step that makes the action undoable and redoable.
3. Define a `UiAction` in `UiState.kt` that corresponds to the user interaction that should trigger this action. This should be defined in **UI-level** terms, enriching the content-level intent with information about how the user is interacting with the application. For example, if the user is supposed to trigger the duplication by performing an action while a node is selected, the `UiAction` might be `DuplicateSelectedNode`, which implies that the currently selected node should be duplicated.
4. In the `uiReducer` function in `UiState.kt`, add a case for the new `UiAction` that dispatches the corresponding `ContentAction` to the `contentReducer`. For example, when `DuplicateSelectedNode` is dispatched, the reducer would check the current selection state to determine which node is selected, and then dispatch a `DuplicateNode` action with the ID of that node.
5. Build `npbloom-core` so that the new actions are included in the generated JavaScript library.
6. In the frontend, add the necessary UI elements to trigger the new `UiAction`.
  a. If it's a menu action, define it under `components/MainMenu.tsx`. If it's a toolbox action, define it under `components/Toolbox.tsx`. If it's a keyboard shortcut without a menu item, define it directly in `UiRoot.tsx`.
  b. Import the new `UiAction` from `npbloom-core`, and then add a new menu item under `mainMenuElements` (`MainMenu.tsx`) or `items` (`Toolbox.tsx`) that dispatches this action when clicked.
  c. If the action has a keyboard shortcut, you should define it in the `hotkey` property of the menu item and implement it using the `useHotkeys` hook.
    * The system for defining hotkeys is a bit unrefined. The `hotkey` property is set independently from the `useHotkeys` hook and can sometimes be defined slightly differently. In our example case, `hotkey` would be defined as `'Control+D'`, while in the `useHotkeys` hook, you would have to listen for both `'Control+D'` and `'Meta+D'` to make sure the Command key on Mac is also supported.
      - The Ctrl key should be referred to as `Control`, not `Ctrl`, to match `useHotkeys`'s expected format.
    * Once the hotkey is defined on the menu or toolbox action, its appearance will adapt to the OS-appropriate format across all three major platforms: "Ctrl+D" on Windows, "⌘D" on Mac, and "Ctrl-D" on Linux.

### String width measurement

As mentioned in the section on the layout algorithm, `npbloom-core` needs to be able to measure the width of strings in pixels in order to position nodes correctly. `npbloom-web` implements this in two ways:
* `strWidthByChars.ts` implements a basic string width measurement function that estimates the width of a string based on a mapping between characters and their widths in pixels. These are coupled with the font used for the sentences in the plot. While it does account for different widths and even kerning to some extent, it only works for a limited set of characters and is not perfectly accurate.
* `strWidthByMeasure.ts` implements a more accurate string width measurement function that uses a hidden `<span>` element on the page to measure the width of any given string in pixels. This is more accurate and works for a wider array of characters, but it is slower, despite optimizations like caching the widths of previously measured strings.

The user can choose which method to use in the settings, and the layout algorithm will use the chosen method when calculating node positions. The state for this is stored in `SettingsState`. The character-based method is the default since it is faster, but users can switch to the measurement-based method if they need more accuracy or are using characters not covered by the character mapping.

### Settings

The frontend uses `SettingsState` to manage user settings in the same way it uses `UiState` to manage the main state of the application.

The settings are stored in a separate context, allowing any component to access them as needed. The provider for this context is set up in `App.tsx`, and the context can be accessed from any component using the `useContext` hook:

```javascript
import SettingsStateContext from '../../SettingsStateContext';
import { SetAutoFormatSubscript } from 'npbloom-core';

// Hook into the settings state context to get the current settings state and dispatch function
const { settingsState, settingsDispatch } = useContext(SettingsStateContext);

// Example of a checkbox for toggling the "auto format subscript" setting
<Checkbox
  label="Format brackets/parentheses as subscript while typing"
  checked={settingsState.autoFormatSubscript}
  onChange={(event) => settingsDispatch(new SetAutoFormatSubscript(event.currentTarget.checked))}
/>
```

Once set, settings are stored in the browser's local storage, allowing them to persist across sessions. When the application starts up, it checks local storage for any saved settings and applies them if they exist.

#### End-to-end guide to adding a new setting

1. Define a new property in `SettingsState` (under `SettingsState.kt`) to represent the setting, along with its default value. For example, if the new setting is "enable dark mode", you might add `darkMode: boolean = false` to `SettingsState`.
2. Define a new `SettingsAction` that represents changing this setting, along with its key and value for storing on the user's device. For example:
  
```kotlin
@JsExport
class SetDarkMode(val darkMode: Boolean) : SettingsAction {
    override val key: String = "darkMode"
    override val value: String = darkMode.toString()
}
```

3. In the `settingsReducer` function in `SettingsState.kt`, add a case for this new action that updates the state accordingly. For example:

```kotlin
is SetDarkMode -> state.copy(darkMode = action.darkMode)
```

4. Build `npbloom-core` so that the new settings action is included in the generated JavaScript library.
5. In the frontend, add the necessary UI elements to allow the user to change this setting. In most cases, this would be a checkbox or other form input in the settings menu. For example, you might add a checkbox for "Enable dark mode" that dispatches `SetDarkMode` when toggled.

```javascript
import { useContext } from 'react';
import SettingsStateContext from '../../SettingsStateContext';
import { SetDarkMode } from 'npbloom-core';

// Hook into the settings state context to get the current settings state and dispatch function
const { settingsState, settingsDispatch } = useContext(SettingsStateContext);

<Checkbox
  label="Enable dark mode"
  checked={settingsState.darkMode}
  onChange={(event) => settingsDispatch(new SetDarkMode(event.currentTarget.checked))}
/>
```

### I/O and file management

The `io` subdirectory groups together features related to input/output operations.

Most of the functionality has to do with transferring data in NPBloom-native formats. These use the same serialization logic described in the section on serialization in `content`.

#### Internal file I/O

Currently, the primary way to save and load entire forests in NPBloom's native format is using the browser's local IndexedDB.

The implementation for this system is located in `io/browserFileIoImpl.ts`, which defines a rudimentary file system with a single "directory" containing "files" that represent saved forests. File information is stored across two stores in the database: one for file metadata (e.g. name, creation date, etc.) and one for file content (the actual serialized forest data).

The main entry points are:
* `openFileDatabase()`: Opens a connection to the IndexedDB database, creating it if it doesn't exist. This must be called before any other file I/O operations, and the resulting database connection must be passed to those operations.
* `getFileMetadataList(db)`: Retrieves a list of metadata for all files currently stored in the database, including their names, modified times, types (currently only `'forest'`), and sizes.
* `saveFileContents(db, fileContents, fileName)`: Saves the given `FileContents` (content state + per-plot pan/zoom states) to a new file with the given name. The object is serialized into CBOR using the logic in `content/SaveLoad.kt` before being stored in the database. An optional parameter `modifiedTime` can be provided to set the modified time of the file; if not provided, it defaults to the current time.
  - Internally, this serializes to CBOR, then calls the private `saveFileRaw` function, which adds the raw content to the content store and the metadata to the metadata store.
* `loadFileContents(db, fileName)`: Loads and deserializes a file from the database by name, returning a `FileContents` object. The file content is deserialized from CBOR using the logic in `content/SaveLoad.kt`.
* `renameFile(db, oldFileName, newFileName)`: Renames the file with the given old name to the new name.
* `deleteFile(db, fileName)`: Deletes the file with the given name from the database.

Serialized data in CBOR is passed between the frontend and `npbloom-core` as an `Int8Array`, which is how Kotlin/JS translates Kotlin `ByteArray`s to JavaScript. This type is also used to store the content in the IndexedDB database.

`browserFileIoImpl.ts` is a pure data layer, knowing about databases, files, and serialization, but nothing about user intent or the rest of the UI. All of its functionality is exposed to the rest of the frontend via the `useBrowserFileIo` hook, which is a higher-level wrapper around the functions described before. This hook bridges the data layer with the UI layer, exposing an interface built around menu actions ("Open", "Save", "Save as") and translating them into the appropriate file operations using a dedicated file I/O modal (`BrowserFileIoModal.tsx`) that handles user interactions related to file management. There is a one-to-one mapping between `useBrowserFileIo`'s exposed functions and menu actions related to file I/O:
* `openFileLoadModal()`: Opens the file load modal, allowing the user to choose a file to load. This calls `loadFileContents` internally with the chosen file. Equivalent to the "Open" menu action.
* `openFileSaveModal()`: Opens the file save modal, allowing the user to choose a name to save under. This constructs a `FileContents` from the current content state and pan/zoom states (via `createFileContents`), then calls `saveFileContents` internally. Equivalent to the "Save As" menu action.
* `saveOrSaveAs()`: If the current content state has already been saved to a file, this saves it to that file again (overwriting the previous content). If it has not been saved before, this opens the file save modal as described above. Equivalent to the "Save" menu action.

`useBrowserFileIo` also exposes `activeFileName`, which is the name of the file that the current content state is saved under, or `null` if it has not been saved before. This is used to show the current file name in the UI. It is _not_ used to determine whether "Save" should trigger a save or a save-as operation; that is determined within `useBrowserFileIo` itself and not exposed to the rest of the frontend.

Finally, `useBrowserFileIo` exposes `browserFileIoModalComponent`, which is the component for the file I/O modal itself. This is only rendered once as part of `MainMenu`.

`renameFile`, `deleteFile`, and `getFileMetadataList` are only accessed from the UI through `BrowserFileIoModal`.

`useBrowserFileIo` is part of the greater `useFileIo` hook, whose other half is the `useSystemFileIo` hook, described in the next section.

#### System file I/O

In addition to the internal file I/O system using IndexedDB, NPBloom also supports importing and exporting files from the user's device using the browser's built-in file picker. This is an experimental feature in early stages and is not guaranteed to be fully stable yet.

The implementation for this system is located in `io/systemFileIoImpl.ts`, which defines two main functions:

* `openFileNative()`: Opens the system file picker for opening files, allowing the user to choose a file from their device to load. The chosen file is returned as a `Uint8Array` along with the file name.
* `saveFileNative(data, suggestedName)`: Opens the system file picker for saving files, allowing the user to choose a location on their device to save the given data. The data is passed as a `Uint8Array`, and an optional suggested file name can be provided.

Each of these functions has two implementations: a modern one using the File System Access API, and a fallback implementation that works by creating temporary links and blobs. The implementation to use is determined automatically depending on the browser's capabilities (whether the API is supported) and its security context (the API is only available in secure contexts, i.e. over HTTPS or on localhost).

These functions are exposed to the rest of the frontend via the `useSystemFileIo` hook, which, like `useBrowserFileIo`, is a higher-level wrapper around the file I/O functions that bridges the data layer with the application state. It exposes two main functions:
* `openSystemFileLoadModal()`: Opens the system file picker for opening files, allowing the user to choose a file to load. This calls `openFileNative` internally, then deserializes the chosen file via `fileContentsFromByteArray` and dispatches `LoadContentState` with the resulting `FileContents` (which includes both content and per-plot pan/zoom states).
* `openSystemFileSaveModal()`: Opens the system file picker for saving files, allowing the user to choose a location to save the current state. This constructs a `FileContents` via `createFileContents` from the current content state and pan/zoom states, serializes it via `fileContentsToByteArray`, then calls `saveFileNative`.

Since the native file I/O system is still experimental and not guaranteed to work in all environments, it is exposed through menu actions as "Import" and "Export", hinting that it is not the primary means of saving and loading files in NPBloom. Unlike the browser file I/O system, the "active file" is not exposed, only existing so that the same name is used when exporting multiple times in a row.

##### Biohazard warning regarding `useSystemFileIo`

There is a nasty hack in `useFileIo` where completing an operation through the native file I/O system clears the "active file" state on the browser file I/O system. This is to prevent confusion in situations like this:
1. The user opens/saves a file using the browser file I/O system, making it the active file.
2. Later, the user imports a different file using the native file I/O system, which replaces the current content state with the new file's content.
3. The user then makes some changes and clicks "Save".

If the active file from the browser file I/O system is still set, this would overwrite the original file from step 1 with the new content from step 2. This might be what the user intended, or it might not, in which case they just accidentally overwrote a file they care about without realizing it.

This data loss prevention justifies the leaky abstraction, but it is something to keep in mind when working with the file I/O code - the two backends are not properly abstracted away.

#### Clipboard operations

The clipboard is currently only used for copying and pasting entire trees (no subtrees or individual nodes). When a tree is copied, it is serialized using the routines in `SaveLoad.kt`, then stored hex-encoded in the clipboard including the magic number and format version. When a tree is pasted into an empty sentence box, the application attempts to deserialize the tree and inserts it into the plot at the selected location. (If the data in the clipboard is not a valid tree, it will be pasted as plain text into the sentence box.) This allows for easy copying and pasting of trees within a plot, between plots, or between different instances of the application.

#### `TextOutputModal`

`TextOutputModal` is a simple modal component that displays a given string of text and allows the user to copy it to the clipboard. It is intended to be used in any place where the user needs to be able to copy a large volume of generated text.

Currently, the only place this is used is in the "Export to labelled bracket notation" feature, which generates a labelled bracket notation representation of the currently selected tree and displays it in the modal for the user to copy. This modal also includes the "Open in" menu, containing the option to open the tree in [Miles Shang's Syntax Tree Generator](https://mshang.ca/syntree/), a popular online tool for visualizing syntax trees that uses labelled bracket notation as its input format.

In the future, this will be used for other export formats as well, such as LaTeX. "Open in" will likewise be expanded to include any relevant external tools that can take the generated output as input, such as LaTeX editors for LaTeX output.

#### Exporting a tree as an image

The `useTreeExport` hook (`useTreeExport.ts`) implements exporting the currently selected tree as a PNG image. Rather than rendering the tree from scratch, it reuses the SVG that is already on screen:
1. Clones the tree's `<g>` element (ID `tree-<id>`), along with the `shape-<id>` group of every node-bound enclosure anchored to that tree.
2. Strips the transforms from every element in the clones (`removeTransformsFromElementTree`). For the tree, this removes its translation into the plot, leaving its contents in tree coordinates. For node-bound enclosures, it removes the tree-matching transform from the visual layer, leaving the enclosure in tree coordinates too - so the two line up without any further calculation, regardless of zoom level.
3. Removes every element that is not marked with `data-npb-export` and has no marked descendants (`removeNonExportElements`). This gets rid of interactive elements like hit areas, handles, and node creation triggers.
4. Puts the clones in a fresh SVG together with the sentence, sized to fit the tree, renders it to an image, and saves it as a PNG.

Free-standing shapes are never included in a tree export, even if they overlap the tree, since they are plot-level entities not associated with any particular tree.

### `meta/` components

The `components/meta` directory contains some components that are not directly related to the functionality of the application itself, but instead give information about the application or otherwise enhance the user experience.

**`PlotPlaceholder`** is a simple component that is rendered in the plot area when there are no trees to display. It takes two forms:
* If `showWelcome` is true, it shows a welcome message prompting the user to create their first tree or watch the demo.
* If `showWelcome` is false, it shows a washed-out NPBloom logo, as an indicator that the plot is currently empty.

    Currently, `showWelcome` is true if the undo/redo history is empty; this way, the welcome message is only shown when the user opens the application, not every time they clear a plot or open a new one.

**`GuidedTour`** is shown when the user clicks "watch a demo" on the welcome message. It is a simple step-by-step animation that demonstrates the process of building a tree for a simple sentence, introducing the user to the basic interactions.
* Under the hood, `GuidedTour` calls `runTour`, which is a function that moves a fake cursor around the screen and dispatches mouse events to simulate the user interactions needed to build the tree.

**`AboutButton`** is a button on the end of the main menu that opens a modal with information about the application. This includes:
* A brief description of what the application is and what it can be used for
* A link to the GitHub repository for the project
* A list of the primary technologies powering the application, with links to their respective websites
* Current version number and time of last update

**`NewVersionModal`** is a modal that is shown when a new version of NPBloom is released, informing users of any new changes and bug fixes. This information is fetched from `currentVersion.tsx` in `npbloom-web/src`. The last version that the user has seen is stored in local storage, so the modal will only be shown once per user per version. This allows users to be informed about new features and updates without being overwhelmed by repeated notifications. The section on releasing a new version below describes how to trigger this modal.

### Releasing a new version of NPBloom

After a change, feature addition, or bug fix where a new version of NPBloom should be released, the following steps should be taken. These should be done after committing the changes to the branch you are working on.

1. Navigate to the `scripts/` directory at the root of the project and run `bump.sh` with the appropriate version bump type (patch, minor, or major). This will update the version number in all places where it is referenced, including `currentVersion.tsx` in `npbloom-web/src`, which is used to trigger the new version modal for users.

    The script will now pause, and a new section will be created at the top of the `HISTORY.md` file with the new version number and the current date.

2. Fill in this section with a summary of the changes included in this release, including any new features, bug fixes, or other relevant information.
3. At this point, you can decide if you want the "New Version" modal to be shown to users upon this release. If you do, navigate to the `currentVersion.tsx` file in `npbloom-web/src` and fill in the `changesFromPreviousVersion` array with a list of new features and bug fixes included in this release. If the array is left empty, the modal will not be shown to users, but they will still see the new version number in the "About" modal.
  * The list of changes in `currentVersion.tsx` should be more concise, relevant to users, and less technical than the list in `HISTORY.md`, which can include more detailed information about the changes for developers and contributors. (If both lists are concise and user-focused, that is also fine.)
4. Save your work, then go back to the terminal where `bump.sh` is running and press Enter to continue. This will commit the changes to the main branch with the message "Bump version to X.Y.Z", where X.Y.Z is the new version number, and tag the commit with the new version number as well. You can then push the commit and tag to the remote repository.
