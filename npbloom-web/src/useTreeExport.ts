import { useContext } from 'react';
import { applyNodePositionsToPlot, ResolvedNodeBoundEnclosureShape, TreeSelectionInPlot } from 'npbloom-core';
import useUiState from './useUiState';
import SettingsStateContext from './SettingsStateContext';
import { saveBlob } from './io/systemFileIoImpl';

// 2px horizontal padding - leave room for antialiasing
const EXPORT_PADDING_X = 2;
// No vertical padding - there is already enough space above and below
const EXPORT_PADDING_Y = 0;

// Scale factor for the exported image
const EXPORT_SCALE = 3;

const EXPORT_SVG_INITIAL_TEMPLATE = `
  <defs>
    <pattern id="folded-pattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-width="1.5" />
    </pattern>
  </defs>
  <style>
    svg { font-family: 'Nimbus Roman', 'Times New Roman', Times, serif; font-size: 16px; }
    line { stroke: #000; stroke-width: 1; }
  </style>
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Recursively removes elements that do not have the `data-npb-export` flag and have no children with that flag.
 * Elements without this flag are intended to be interactive, and have no use on the exported image.
 * Removing them reduces clutter and prevents issues with elements being rendered with incorrect styles in the export.
 */
const removeNonExportElements = (element: Element) => {
  Array.from(element.children).forEach(child => {
    if (child.hasAttribute('data-npb-export')) return;
    removeNonExportElements(child);
    if (child.children.length === 0) child.remove();
  });
};

const removeTransformsFromElementTree = (element: SVGElement) => {
  element.style.transform = '';
  Array.from(element.children).forEach(child => {
    if (child instanceof SVGElement) {
      removeTransformsFromElementTree(child);
    }
  });
};

function initializeSvg(viewBoxX: number, viewBoxY: number, viewBoxWidth: any, viewBoxHeight: number) {
  const exportSvg = document.createElementNS(SVG_NS, 'svg');
  exportSvg.setAttribute('xmlns', SVG_NS);
  exportSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
  exportSvg.setAttribute('width', String(viewBoxWidth * EXPORT_SCALE));
  exportSvg.setAttribute('height', String(viewBoxHeight * EXPORT_SCALE));

  exportSvg.innerHTML = EXPORT_SVG_INITIAL_TEMPLATE;

  return exportSvg;
}

function saveSvgAsImage(exportSvg: SVGSVGElement, filename: string) {
  if ((!exportSvg.width.baseVal.value || !exportSvg.height.baseVal.value) &&
    !exportSvg.viewBox.baseVal.width && !exportSvg.viewBox.baseVal.height) {
    throw new Error('SVG has no defined dimensions, cannot export as image');
  }

  const serialized = new XMLSerializer().serializeToString(exportSvg);
  const blob = new Blob([serialized], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  // Create an image element to load the SVG and draw it onto a canvas, which we can then export as a PNG
  const img = new Image();

  // Everything inside the block below will happen _after_ the image URL is already set
  img.onload = () => {
    // The canvas dimensions should match the width and height of the SVG element
    const canvas = document.createElement('canvas');
    canvas.width = exportSvg.width.baseVal.value || exportSvg.viewBox.baseVal.width;
    canvas.height = exportSvg.height.baseVal.value || exportSvg.viewBox.baseVal.height;

    // Draw the loaded image onto the canvas, then convert the canvas to a PNG blob and save it
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Having copied the image onto the canvas, we're done with it, so we can release the object URL
    URL.revokeObjectURL(url);

    // The canvas now contains everything we need
    canvas.toBlob(async pngBlob => {
      if (!pngBlob) return;
      await saveBlob(pngBlob, filename, [{
        description: 'PNG Image',
        accept: { 'image/png': ['.png'] },
      }]);
    }, 'image/png');

    // Clean up the canvas element after saving - we don't need it anymore
    setTimeout(() => canvas.remove(), 2000);
  };

  // Setting the source of the image will start loading the image,
  // and eventually trigger the onload handler defined above
  img.src = url;
}

const useTreeExport = () => {
  const { state } = useUiState();
  const { strWidth } = useContext(SettingsStateContext);

  const exportSelectedTree = () => {
    // If we don't have exactly one tree selected, we can't export - bail out
    if (!(state.selection instanceof TreeSelectionInPlot)) return;
    const treeIds = state.selection.treeIdsAsArray;
    if (treeIds.length !== 1) return;
    const treeId = treeIds[0];

    // TODO: Potential refactor: Restructure the code so that the positioned plot is already available here
    const plot = applyNodePositionsToPlot(strWidth, state.contentState.current.plots[state.activePlotIndex]);
    const tree = plot.tree(treeId);

    // Find the <g> element corresponding to the tree, and clone it for export
    const treeGroup = document.getElementById(`tree-${treeId}`);
    if (!treeGroup) return;
    const clones = [treeGroup.cloneNode(true) as SVGGElement];

    // Find shape elements corresponding to the bound enclosures in this tree
    const boundEnclosureGroups = plot.shapes
      .filter(shape => shape instanceof ResolvedNodeBoundEnclosureShape && shape.nodeIndicatorInPlot.treeId === treeId)
      .map(shape => document.getElementById(`shape-${shape.id}`) as (SVGGElement | null))
      .filter(shape => shape)
      .map(shape => (shape as SVGGElement).cloneNode(true)) as SVGGElement[];
    clones.push(...boundEnclosureGroups);

    // Reset translations on all clones and remove elements that are not marked for export
    clones.forEach(clone => {
      removeTransformsFromElementTree(clone);
      removeNonExportElements(clone);
    });

    // Determine the area we need for the tree to fit
    const viewBoxX = -EXPORT_PADDING_X;
    const viewBoxY = tree.visualTopBound - EXPORT_PADDING_Y; // If there are any nodes in the tree, this will be negative
    const viewBoxWidth = tree.width + 2 * EXPORT_PADDING_X;
    const viewBoxHeight = tree.visualBottomBound - tree.visualTopBound + 2 * EXPORT_PADDING_Y;

    // Initialize the export SVG at the correct size
    const exportSvg = initializeSvg(viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight);

    // Add the sentence as a text element matching the tree's anchor position
    // (top of the sentence is y=0; nodes are at y < 0, matching the main SVG view)
    const sentenceText = document.createElementNS(SVG_NS, 'text');
    sentenceText.setAttribute('x', '0');
    sentenceText.setAttribute('y', '0');
    sentenceText.setAttribute('dominant-baseline', 'hanging');
    sentenceText.setAttribute('xml:space', 'preserve');
    sentenceText.textContent = tree.sentence;
    exportSvg.appendChild(sentenceText);

    // Finally, add the cloned groups on top - the locations will already match, even for bound enclosures,
    // thanks to their two-layer positioning system (the outer layer is simply discarded)
    clones.forEach(clone => exportSvg.appendChild(clone));

    const filename = (tree.sentence.replace(/[^a-z0-9]+/gi, '_').toLowerCase().slice(0, 30) || 'tree') + '.png';
    saveSvgAsImage(exportSvg, filename);
  };

  return { exportSelectedTree };
};

export default useTreeExport;
