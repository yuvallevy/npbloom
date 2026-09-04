@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content

import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

typealias NodeLabel = String

@JsExport
interface NodeBase : WithId {
    val label: NodeLabel
    val yAlignMode: YAlignMode
}
