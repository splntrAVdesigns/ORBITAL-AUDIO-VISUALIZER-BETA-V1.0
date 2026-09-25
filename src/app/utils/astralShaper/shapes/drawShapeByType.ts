/**
 * Liquid Shaper - Dispatch from ShapeType to its generator.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { drawCelticKnot, drawDoubleHelix, drawFibonacciSpiral, drawFlowerOfLife, drawGoldenSpiral, drawHexagonLattice, drawIcosahedron, drawLabyrinth, drawLotusMandala, drawMandala, drawMerkaba, drawMetatronsCube, drawPlatonicSolid, drawSeedOfLife, drawSimpleCircle, drawSimpleOctagon, drawSimplePentagon, drawSimpleSquare, drawSimpleTriangle, drawSriYantra, drawStarTetrahedron, drawTorusKnot, drawTriangleGrid, drawVesicaPiscis } from './classic';
import { drawArcSegments, drawConcentricSquares, drawConcentricTriangles, drawCrosshairRings, drawIsometricGrid, drawNestedPolygons, drawOrbitalNodes, drawRadarSweep, drawRadialLines, drawStarPolygon } from './geometricVJ';
import { drawAlchemySymbols, drawAstralChart, drawCircuitGlyph, drawCompassRose, drawLunarPhases, drawRunicRing, drawSigilCircle, drawSolarDisc, drawTabletLines, drawTechnoHiero } from './glyphs';
import { drawDihedral, drawMirrorHex, drawMirrorOct, drawMirrorQuad, drawPolarWedge, drawRadialTiles, drawRosette, drawSeamHide } from './kaleidoscope';
import { drawCubeOfSpace, drawDodecahedron, drawFlowerExtended, drawFruitOfLife, drawMetatronDense, drawPlatonicStack, drawSriYantraDense, drawTetrahedron, drawTorusHalo, drawVesicaChain } from './sacredExtended';
import { drawGuillocheRibbon, drawGuillocheRosette, drawHarmonograph, drawLissajous, drawMoireDisc, drawMoireLattice, drawSpirographEpi, drawSpirographHypo } from './spirograph';
import type { ShapeType } from '../types';

/**
 * Draw shape by type
 */
export function drawShapeByType(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  rotation: number,
  shapeType: ShapeType,
  complexity: number
) {
  switch (shapeType) {
    case 'flower-of-life':
      drawFlowerOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'seed-of-life':
      drawSeedOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'metatron-cube':
      drawMetatronsCube(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sri-yantra':
      drawSriYantra(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'hexagon-lattice':
      drawHexagonLattice(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'triangle-grid':
      drawTriangleGrid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vesica-piscis':
      drawVesicaPiscis(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'circle':
      drawSimpleCircle(ctx, cx, cy, baseRadius);
      break;
    case 'square':
      drawSimpleSquare(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'triangle':
      drawSimpleTriangle(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'pentagon':
      drawSimplePentagon(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'octagon':
      drawSimpleOctagon(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'torus-knot':
      drawTorusKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'mandala':
      drawMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'star-tetrahedron':
      drawStarTetrahedron(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'icosahedron':
      drawIcosahedron(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'merkaba':
      drawMerkaba(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'double-helix':
      drawDoubleHelix(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fibonacci-spiral':
      drawFibonacciSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'golden-spiral':
      drawGoldenSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'lotus-mandala':
      drawLotusMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'celtic-knot':
      drawCelticKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'platonic-solid':
      drawPlatonicSolid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'labyrinth':
      drawLabyrinth(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
      
    // A. Sacred Geometry Classics - NEW SHAPES
    case 'sg-seed-of-life':
      drawSeedOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-flower-of-life':
      drawFlowerOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-flower-extended':
      drawFlowerExtended(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-vesica-piscis':
      drawVesicaPiscis(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-vesica-chain':
      drawVesicaChain(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-torus-halo':
      drawTorusHalo(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-metatron-cube':
      drawMetatronsCube(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-metatron-dense':
      drawMetatronDense(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-fruit-of-life':
      drawFruitOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-cube-of-space':
      drawCubeOfSpace(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-sri-yantra':
      drawSriYantra(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-sri-yantra-dense':
      drawSriYantraDense(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-merkaba':
      drawMerkaba(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-tetrahedron':
      drawTetrahedron(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-icosahedron':
      drawIcosahedron(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-dodecahedron':
      drawDodecahedron(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-platonic-stack':
      drawPlatonicStack(ctx, cx, cy, baseRadius, rotation);
      break;
      
    // B. Kaleidoscope & Symmetry - NEW SHAPES
    case 'kx-mirror-quad':
      drawMirrorQuad(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'kx-mirror-hex':
      drawMirrorHex(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'kx-mirror-oct':
      drawMirrorOct(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'kx-polar-wedge':
      drawPolarWedge(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-rosette':
      drawRosette(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-mandala-rings':
      drawMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-radial-tiles':
      drawRadialTiles(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-dihedral':
      drawDihedral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-seam-hide':
      drawSeamHide(ctx, cx, cy, baseRadius, rotation);
      break;
      
    // C. Spirograph / Guilloché / Moiré - NEW SHAPES
    case 'fx-spirograph-hypo':
      drawSpirographHypo(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-spirograph-epi':
      drawSpirographEpi(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-guilloche-rosette':
      drawGuillocheRosette(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-guilloche-ribbon':
      drawGuillocheRibbon(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-moire-disc':
      drawMoireDisc(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-moire-lattice':
      drawMoireLattice(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-lissajous':
      drawLissajous(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-harmonograph':
      drawHarmonograph(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-fibonacci-spiral':
      drawFibonacciSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-golden-spiral':
      drawGoldenSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-torus-knot':
      drawTorusKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
      
    // D. Glyph / Rune / Hieroglyph - NEW SHAPES
    case 'gl-runic-ring':
      drawRunicRing(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-sigil-circle':
      drawSigilCircle(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-solar-disc':
      drawSolarDisc(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-lunar-phases':
      drawLunarPhases(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-alchemy-symbols':
      drawAlchemySymbols(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-astral-chart':
      drawAstralChart(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-techno-hiero':
      drawTechnoHiero(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-circuit-glyph':
      drawCircuitGlyph(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-tablet-lines':
      drawTabletLines(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-compass-rose':
      drawCompassRose(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-celtic-knot':
      drawCelticKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-lotus-mandala':
      drawLotusMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-labyrinth':
      drawLabyrinth(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
      
    // E. Geometric Standard (VJ) - NEW SHAPES
    case 'vj-hex-grid':
      drawHexagonLattice(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-triangle-grid':
      drawTriangleGrid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-isometric-grid':
      drawIsometricGrid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-concentric-squares':
      drawConcentricSquares(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-concentric-triangles':
      drawConcentricTriangles(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-nested-polygons':
      drawNestedPolygons(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-star-polygon':
      drawStarPolygon(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-radial-lines':
      drawRadialLines(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-radar-sweep':
      drawRadarSweep(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-orbital-nodes':
      drawOrbitalNodes(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-arc-segments':
      drawArcSegments(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-crosshair-rings':
      drawCrosshairRings(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-circle':
      drawSimpleCircle(ctx, cx, cy, baseRadius);
      break;
    case 'vj-square':
      drawSimpleSquare(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-triangle':
      drawSimpleTriangle(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-pentagon':
      drawSimplePentagon(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-octagon':
      drawSimpleOctagon(ctx, cx, cy, baseRadius, rotation);
      break;
  }
}
