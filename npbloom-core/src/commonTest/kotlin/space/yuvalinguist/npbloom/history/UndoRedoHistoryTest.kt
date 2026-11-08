package space.yuvalinguist.npbloom.history

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotSame
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class UndoRedoHistoryTest {
    private val initialState = TestState(numberValue = 8, stringValue = "alright very cool!")

    private val action1: TestAction = SetString(oldValue = "alright very cool!", newValue = "alright cool!")

    private val action2: TestAction = IncrementNumber(difference = 11)

    private val initialUndoRedoHistory = UndoRedoHistory(::testApplyAction, ::testReverseAction, initialState)

    private val undoRedoHistoryAfterTwoActions = initialUndoRedoHistory.copy(
        current = initialState.copy(numberValue = 19, stringValue = "alright cool!"),
        undoStack = listOf(action2, action1),
    )

    private val undoRedoHistoryAfterUndoOnce = initialUndoRedoHistory.copy(
        current = initialState.copy(stringValue = "alright cool!"),
        undoStack = listOf(action1),
        redoStack = listOf(action2),
    )

    private val undoRedoHistoryAfterUndoTwice = initialUndoRedoHistory.copy(
        redoStack = listOf(action1, action2),
    )

    @Test
    fun testApplyTwoActions() =
        assertEquals(
            undoRedoHistoryAfterTwoActions,
            initialUndoRedoHistory.applyAction(action1).applyAction(action2)
        )

    @Test
    fun testApplyTwoActionsAndUndoOne() =
        assertEquals(
            undoRedoHistoryAfterUndoOnce,
            initialUndoRedoHistory.applyAction(action1).applyAction(action2).undo()
        )

    @Test
    fun testApplyTwoActionsAndUndoBoth() =
        assertEquals(
            undoRedoHistoryAfterUndoTwice,
            initialUndoRedoHistory.applyAction(action1).applyAction(action2).undo().undo()
        )

    @Test
    fun testApplyTwoActionsUndoOneThenRedoIt() =
        assertEquals(
            undoRedoHistoryAfterTwoActions,
            initialUndoRedoHistory.applyAction(action1).applyAction(action2).undo().redo()
        )

    @Test
    fun testApplyTwoActionsUndoBothThenRedoOne() =
        assertEquals(
            undoRedoHistoryAfterUndoOnce,
            initialUndoRedoHistory.applyAction(action1).applyAction(action2).undo().undo().redo()
        )

    @Test
    fun testCanUndoTrue() =
        assertTrue(undoRedoHistoryAfterUndoOnce.canUndo)

    @Test
    fun testCanUndoFalse() =
        assertFalse(undoRedoHistoryAfterUndoTwice.canUndo)

    @Test
    fun testCanRedoTrue() =
        assertTrue(undoRedoHistoryAfterUndoOnce.canRedo)

    @Test
    fun testCanRedoFalse() =
        assertFalse(undoRedoHistoryAfterTwoActions.canRedo)

    @Test
    fun testLastActionInitiallyNull() =
        assertNull(initialUndoRedoHistory.lastAction)

    @Test
    fun testLastActionAfterApply() =
        assertSame(action2, initialUndoRedoHistory.applyAction(action1).applyAction(action2).lastAction)

    @Test
    fun testLastActionAfterUndo() =
        assertSame(action1, initialUndoRedoHistory.applyAction(action1).applyAction(action2).undo().lastAction)

    @Test
    fun testLastActionAfterUndoAll() =
        assertNull(initialUndoRedoHistory.applyAction(action1).undo().lastAction)

    @Test
    fun testLastActionAfterUndoThenRedo() =
        assertSame(action2, initialUndoRedoHistory.applyAction(action1).applyAction(action2).undo().redo().lastAction)

    @Test
    fun testLastActionAfterUndoThenNewEqualAction() {
        // A new action, even one structurally equal to the undone one, must be a different marker
        val history = initialUndoRedoHistory.applyAction(action2).undo().applyAction(IncrementNumber(difference = 11))
        assertNotSame(action2, history.lastAction)
    }
}
