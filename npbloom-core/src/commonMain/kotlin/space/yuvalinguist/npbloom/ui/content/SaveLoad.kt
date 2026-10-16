@file:OptIn(ExperimentalSerializationApi::class, ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.ui.content

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.cbor.*
import kotlinx.serialization.decodeFromByteArray
import kotlinx.serialization.encodeToByteArray
import space.yuvalinguist.npbloom.content.unpositioned.UnpositionedTree
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.js.JsName

@OptIn(ExperimentalStdlibApi::class)
private val forestMagicNumber = "59b10011f04e5700".hexToByteArray()
@OptIn(ExperimentalStdlibApi::class)
private val treeMagicNumber = "59b1001174ee0000".hexToByteArray()

// The format version is a 2-byte sequence that is incremented whenever the file format changes in a way that is not
// backwards-compatible.
private val formatVersion = byteArrayOf(2, 1)
private val oldFormatVersions =
    listOf(byteArrayOf(1, 0), byteArrayOf(1, 1), byteArrayOf(1, 2), byteArrayOf(1, 3), byteArrayOf(2, 0))

// In versions 1.x the serialized object was a bare ContentState - no other metadata
private val bareContentStateFormatVersions =
    listOf(byteArrayOf(1, 0), byteArrayOf(1, 1), byteArrayOf(1, 2), byteArrayOf(1, 3))

// ignoreUnknownKeys makes decoding tolerant of fields that existed in older format versions and were since removed
// (e.g. the node-level enclosure corner radius replaced by NodeBoundEnclosureShape in format 2.1).
private val cbor = Cbor { ignoreUnknownKeys = true }

@JsExport
@JsName("fileContentsToByteArray")
fun FileContents.toByteArray() =
    forestMagicNumber + formatVersion + cbor.encodeToByteArray(this)

@JsExport
@JsName("treeToByteArray")
fun UnpositionedTree.toByteArray() =
    treeMagicNumber + formatVersion + cbor.encodeToByteArray(this)

private fun formatVersionIsRecognized(fileFormatVersion: ByteArray) =
    fileFormatVersion.contentEquals(formatVersion) || oldFormatVersions.any(fileFormatVersion::contentEquals)

private fun isBareContentStateFormatVersion(fileFormatVersion: ByteArray) =
    bareContentStateFormatVersions.any(fileFormatVersion::contentEquals)

fun FileContents.Companion.fromByteArray(byteArray: ByteArray): FileContents {
    if (!byteArray.sliceArray(forestMagicNumber.indices).contentEquals(forestMagicNumber)) error("This is not an NPBloom file")
    val fileFormatVersion = byteArray.sliceArray(forestMagicNumber.size until forestMagicNumber.size + formatVersion.size)
    if (!formatVersionIsRecognized(fileFormatVersion))
        error("Unrecognized file format version: ${fileFormatVersion.joinToString(".")}")
    val body = byteArray.sliceArray(forestMagicNumber.size + formatVersion.size until byteArray.size)
    try {
        val decodedFileContents = if (isBareContentStateFormatVersion(fileFormatVersion)) {
            // Formats 1.0-1.3: body is a bare ContentState; wrap with empty plotPanZoomStates
            FileContents(contentState = cbor.decodeFromByteArray(body))
        } else {
            cbor.decodeFromByteArray(body)
        }
        println("Decoded contents from file with format version ${fileFormatVersion.joinToString(".")}")
        return decodedFileContents
    } catch (e: SerializationException) {
        error("The file appears to be corrupt")
    }
}

fun UnpositionedTree.Companion.fromByteArray(byteArray: ByteArray): UnpositionedTree {
    if (!byteArray.sliceArray(treeMagicNumber.indices).contentEquals(treeMagicNumber)) error("This is not an NPBloom tree")
    val fileFormatVersion = byteArray.sliceArray(treeMagicNumber.size until treeMagicNumber.size + formatVersion.size)
    if (!formatVersionIsRecognized(fileFormatVersion))
        error("Unrecognized file format version: ${fileFormatVersion.joinToString(".")}")
    try {
        return cbor.decodeFromByteArray(
            byteArray.sliceArray(treeMagicNumber.size + formatVersion.size until byteArray.size))
    } catch (e: SerializationException) {
        error("The file appears to be corrupt")
    }
}
