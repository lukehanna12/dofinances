/* Recovered Colosseum catalog item 0001c1, CTA 6.
   The 11x6 lattice, exact icon coordinates, deterministic tile occupancy,
   and .03s row-plus-column entrance staggering follow cta-6.jsx.
   Icon paths are from the canonical Lucide open-source SVGs.
   The Dashboard CTA text is intentionally minimal. */
import {PROJECT_SHOWCASE,sortProjectShowcase,publicProjectIconSource}
  from "../public-projects-catalog.js";

// Preserve all sixteen ORIGINAL 11x6 icon slots. Each slot receives the
// corresponding project from the same ordered collection used on /projects.
// Updating an icon in PROJECT_CARD_ICONS (or its SVG file) updates BOTH
// public screens without touching this module. The /app mosaic is untouched.
const HOME_ICON_POSITIONS=Object.freeze(["0:1","0:5","0:8","1:0","1:6","1:9","2:1","2:9","3:0","3:10","4:2","4:5","4:8","5:1","5:6","5:9"]);
const sortedProjects=sortProjectShowcase(PROJECT_SHOWCASE);
const positionProjects=new Map(HOME_ICON_POSITIONS.map((position,index)=>
  [position,sortedProjects[index]]).filter(([,project])=>
    Boolean(project&&publicProjectIconSource(project.slug))));
// Explicit additions keep the 16 icon SLOTS and original lattice intact.
// One new clear square in row 3, column 3: three columns right of Palette (3:0).
const centerGlass=new Set(["2:4","2:6","3:5","3:3","4:3"]);
// Seventh row, left to right: 1 = icon-less glass; 0 = empty slot.
// Exact requested pattern: 11010100101 (six glass squares).
const entryGlassColumns=new Set([0,1,3,5,8,10]);
const root=document.getElementById("cta6-mosaic");
if(root){
  const cells=document.createDocumentFragment();
  for(let index=0;index<66;index++){
    const row=Math.floor(index/11);
    const col=index%11;
    const center=row>=2&&row<=3&&col>=3&&col<=7;
    const project=positionProjects.get(`${row}:${col}`);
    const iconSource=project?publicProjectIconSource(project.slug):null;
    const hash=43758.5453*Math.sin(127.1*row+311.7*col);
    const filled=centerGlass.has(row+":"+col) ||
      (!center&&(hash-Math.floor(hash))>.35);
    const tile=document.createElement("div");
    tile.className="cta6-tile "+(iconSource?"cta6-tile--icon":
      filled?"cta6-tile--plain":"cta6-tile--empty");
    if(iconSource){
      tile.dataset.homeProjectIcon=project.slug;
      const icon=document.createElement("img");
      icon.className="cta6-icon";
      icon.src=iconSource;
      icon.alt="";
      icon.width=24;icon.height=24;
      icon.decoding="async";
      icon.draggable=false;
      icon.setAttribute("aria-hidden","true");
      tile.append(icon);
    }
    tile.style.setProperty("--cta6-delay",((row+col)*.03).toFixed(2)+"s");
    cells.append(tile);
  }
  // The seventh track lane is positioned outside the six-row grid.
  // It never participates in grid sizing or moves the central copy.
  const entry=document.createElement("div");
  entry.className="cta6-track-entry";
  entry.setAttribute("aria-hidden","true");
  // This seventh lane must be hidden before entering the DOM. The
  // separate GPU glass remains free to fade in when moving upward.
  entry.style.opacity="0";
  for(let col=0;col<11;col++){
    const tile=document.createElement("div");
    tile.className="cta6-tile "+(entryGlassColumns.has(col)?
      "cta6-tile--plain":"cta6-tile--empty");
    tile.style.setProperty("--cta6-delay","0s");
    entry.append(tile);
  }
  root.replaceChildren(cells,entry);
}
