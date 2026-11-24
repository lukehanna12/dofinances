import {BOOTSCRIPT_DIAGRAM_SVG} from "./public-projects-bootscript-diagram.js";
/* Source-authored public architecture schematics. All artwork here is
 * native SVG foreground, never a texture or part of the optical backdrop.
 * Future architecture is explicitly marked as planned. */
export const PROJECT_DIAGRAMS=Object.freeze({
  "bootscript": [
    {
      "title": "Development architecture",
      "renderer": "d2",
      "label": "Google Apps Script IDE; BootScript native editor integration, 57 themes, modal editing, cross-file search and inline diagnostics; extension-owned project console, TypeScript intelligence, project search and export, encrypted vault, GitHub review, collaborative drafts and HTML/CSS previews; authorized Apps Script, GitHub, Gemini and Sheets APIs.",
      "planned": false
    }
  ],
  "translucence-lab": [
    {
      "title": "Optical laboratory",
      "rows": [
        [
          "Geometry",
          "Light sources"
        ],
        [
          "Surface optics",
          "Volume optics"
        ],
        [
          "Metal renderer"
        ],
        [
          "Interactive scene"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          1,
          1,
          0
        ],
        [
          0,
          1,
          1,
          1
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ]
      ],
      "planned": false
    }
  ],
  "github-readme-chrome-extension": [
    {
      "title": "Live GitHub editing",
      "rows": [
        [
          "GitHub source editor"
        ],
        [
          "ReadMe GitHub Live"
        ],
        [
          "Rendered document"
        ],
        [
          "Inline edits"
        ],
        [
          "GitHub commit"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          3,
          0,
          4,
          0
        ]
      ],
      "planned": false
    }
  ],
  "chatgpt-chat-save-chrome-extension": [
    {
      "title": "Capture",
      "rows": [
        [
          "Open conversation"
        ],
        [
          "Messages",
          "Files",
          "Evidence"
        ],
        [
          "Local capture"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          0,
          1,
          1
        ],
        [
          0,
          0,
          1,
          2
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ],
        [
          1,
          2,
          2,
          0
        ]
      ],
      "planned": false
    },
    {
      "title": "Continue the work",
      "rows": [
        [
          "Verified archive"
        ],
        [
          "Search index",
          "Branch graph"
        ],
        [
          "Resume with AI"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          0,
          1,
          1
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ]
      ],
      "planned": false
    }
  ],
  "colosseum": [
    {
      "title": "Connection and permissions",
      "rows": [
        [
          "ChatGPT",
          "Claude (planned)"
        ],
        [
          "Plugin router"
        ],
        [
          "Access policy",
          "Tool catalog"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          1,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          0,
          2,
          1
        ]
      ],
      "planned": false
    },
    {
      "title": "Organized capabilities",
      "rows": [
        [
          "Catalog + collections"
        ],
        [
          "Local tools",
          "Cloud services",
          "References"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          0,
          1,
          1
        ],
        [
          0,
          0,
          1,
          2
        ]
      ],
      "planned": false
    }
  ],
  "apple-hig-reader": [
    {
      "title": "Free-hosted reference service",
      "rows": [
        [
          "AI assistant"
        ],
        [
          "/mcp (planned)"
        ],
        [
          "Apps Script",
          "Cache"
        ],
        [
          "Apple DocC"
        ],
        [
          "Readable guidance"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          2,
          1
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          3,
          0,
          4,
          0
        ]
      ],
      "planned": true
    }
  ],
  "terminal-scalars": [
    {
      "title": "Native terminal framework",
      "rows": [
        [
          "Apple Terminal"
        ],
        [
          "Glyph shapes",
          "Font sources",
          "Metrics"
        ],
        [
          "Native text model"
        ],
        [
          "CLI features",
          "TUI features"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          0,
          1,
          1
        ],
        [
          0,
          0,
          1,
          2
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ],
        [
          1,
          2,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          2,
          0,
          3,
          1
        ]
      ],
      "planned": false
    }
  ],
  "unicode-plus": [
    {
      "title": "LaTeX to native text",
      "rows": [
        [
          "LaTeX input"
        ],
        [
          "Verified symbol catalog"
        ],
        [
          "Unicode converter"
        ],
        [
          "Terminal",
          "Other projects\n(planned)"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          2,
          0,
          3,
          1
        ]
      ],
      "planned": false
    }
  ],
  "liquid-plexiglass-26": [
    {
      "title": "Reconstruction pipeline",
      "rows": [
        [
          "Native macOS 26"
        ],
        [
          "Measurements",
          "Shader evidence"
        ],
        [
          "Mathematical model"
        ],
        [
          "Rust",
          "WebGPU"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          0,
          1,
          1
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          2,
          0,
          3,
          1
        ]
      ],
      "planned": true
    }
  ],
  "3d-liquid-glass-26-swift-package": [
    {
      "title": "Research to Swift package",
      "rows": [
        [
          "Plexiglass 26",
          "Plexiglass 27",
          "Lightwork"
        ],
        [
          "Geometry + optical dynamics"
        ],
        [
          "Swift package"
        ],
        [
          "macOS 26",
          "macOS 27"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          1,
          1,
          0
        ],
        [
          0,
          2,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          2,
          0,
          3,
          1
        ]
      ],
      "planned": true
    }
  ],
  "apple-adobe-fx": [
    {
      "title": "Reusable visual effect",
      "rows": [
        [
          "Open-source Photoshop\nreconstruction"
        ],
        [
          "Effect reconstruction"
        ],
        [
          "Reusable library"
        ],
        [
          "Creative projects"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ]
      ],
      "planned": true
    }
  ],
  "protocol-monitor-pruner": [
    {
      "title": "From capture to archive",
      "rows": [
        [
          "Chrome Protocol Monitor"
        ],
        [
          "Saved JSON export"
        ],
        [
          "Scope selected messages"
        ],
        [
          "Exact records",
          "Search index"
        ],
        [
          "SQLite archive"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          2,
          0,
          3,
          1
        ],
        [
          3,
          0,
          4,
          0
        ],
        [
          3,
          1,
          4,
          0
        ]
      ],
      "planned": false
    }
  ],
  "app-caviar": [
    {
      "title": "Build on an iPhone",
      "rows": [
        [
          "Idea"
        ],
        [
          "Homegrown AI",
          "Visual components"
        ],
        [
          "iOS application"
        ],
        [
          "Build + deploy"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          0,
          1,
          1
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ]
      ],
      "planned": true
    }
  ],
  "ozoning-board": [
    {
      "title": "AI collaboration",
      "rows": [
        [
          "AI assistants",
          "Other agents"
        ],
        [
          "MCP tools",
          "A2A protocol"
        ],
        [
          "Apps Script"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          1,
          1,
          1
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          1,
          2,
          0
        ]
      ],
      "planned": true
    },
    {
      "title": "In-memory build",
      "rows": [
        [
          "Source + dependencies"
        ],
        [
          "Vite + React"
        ],
        [
          "Built application"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ]
      ],
      "planned": true
    }
  ],
  "hidden-functions": [
    {
      "title": "Function discovery",
      "rows": [
        [
          "Documented functions",
          "Hidden functions"
        ],
        [
          "Searchable function catalog"
        ],
        [
          "Intuitive Sheets add-on"
        ],
        [
          "Spreadsheet"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          0,
          1,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          2,
          0,
          3,
          0
        ]
      ],
      "planned": true
    }
  ],
  "latexcel": [
    {
      "title": "Rendered notation",
      "rows": [
        [
          "LaTeX expression"
        ],
        [
          "Notation renderer"
        ],
        [
          "Excel add-in",
          "Sheets add-on"
        ],
        [
          "Workbook",
          "Spreadsheet"
        ]
      ],
      "edges": [
        [
          0,
          0,
          1,
          0
        ],
        [
          1,
          0,
          2,
          0
        ],
        [
          1,
          0,
          2,
          1
        ],
        [
          2,
          0,
          3,
          0
        ],
        [
          2,
          1,
          3,
          1
        ]
      ],
      "planned": true
    }
  ]
});
const NS="http://www.w3.org/2000/svg";
const svgNode=(name,attrs={},text)=>{
  const node=document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  if(text!==undefined)node.textContent=text;
  return node;
};
export function projectDiagramLayout(spec,compact=false){
  const width=360,pad=5,gap=9,nodeHeight=compact?34:40,rowGap=compact?16:23;
  const rows=spec.rows.map((row,i)=>{
    const available=width-2*pad-(row.length-1)*gap;
    const w=Math.min(available/row.length,row.length===1?258:row.length===2?168:110);
    const x=(width-(w*row.length+gap*(row.length-1)))/2;
    return row.map((label,j)=>({label,x:x+j*(w+gap),y:pad+i*(nodeHeight+rowGap),w,h:nodeHeight}));
  });
  const height=2*pad+rows.length*nodeHeight+(rows.length-1)*rowGap;
  return {width,height,rows};
}
export function createProjectDiagrams(slug){
  const specs=PROJECT_DIAGRAMS[slug];
  if(!specs)throw new Error("Missing architecture for "+slug);
  const group=document.createElement("span");
  group.className="project-showcase-diagrams";
  group.id="project-diagrams-"+slug;
  group.setAttribute("aria-hidden","true");
  for(const spec of specs){
    const figure=document.createElement("span");
    figure.className="project-showcase-diagram";
    const caption=document.createElement("span");
    caption.className="project-showcase-diagram-caption";
    caption.textContent=spec.title+(spec.planned?" (planned architecture)":"");
    if(spec.renderer==="d2"){
      const parsed=new DOMParser().parseFromString(BOOTSCRIPT_DIAGRAM_SVG,"image/svg+xml");
      const root=parsed.documentElement;
      if(root.namespaceURI!==NS||root.localName!=="svg"||parsed.querySelector("parsererror")){
        throw new Error("Invalid generated BootScript diagram");
      }
      const svg=document.importNode(root,true);
      svg.setAttribute("role","img");
      svg.setAttribute("aria-label",spec.label);
      figure.classList.add("project-showcase-diagram--d2");
      figure.append(caption,svg);group.append(figure);
      continue;
    }
    const {width,height,rows}=projectDiagramLayout(spec,specs.length>1);
    const svg=svgNode("svg",{viewBox:"0 0 "+width+" "+height,role:"img",
      "aria-label":spec.title+(spec.planned?", planned architecture":"")+": "+spec.rows.map(r=>r.join(", ")).join("; ")});
    svg.append(svgNode("title",{},spec.title));
    // Explicit orthogonal links, with individual arrowheads (no cloned IDs).
    for(const [ar,ac,br,bc] of spec.edges){
      const a=rows[ar][ac],b=rows[br][bc];
      let x1=a.x+a.w/2,y1=a.y+a.h,x2=b.x+b.w/2,y2=b.y;
      if(ar===br){
        x1=a.x+a.w;y1=a.y+a.h/2;x2=b.x;y2=b.y+b.h/2;
        svg.append(svgNode("path",{class:"project-diagram-link",d:"M"+x1+" "+y1+"H"+(x2-1)}),
          svgNode("path",{class:"project-diagram-link",d:"M"+(x2-5)+" "+(y2-3)+"L"+(x2-1)+" "+y2+"L"+(x2-5)+" "+(y2+3)}));
      }else{
        const m=(y1+y2)/2;
        svg.append(svgNode("path",{class:"project-diagram-link",d:"M"+x1+" "+y1+"V"+m+"H"+x2+"V"+(y2-1)}),
          svgNode("path",{class:"project-diagram-link",d:"M"+(x2-3)+" "+(y2-5)+"L"+x2+" "+(y2-1)+"L"+(x2+3)+" "+(y2-5)}));
      }
    }
    for(const row of rows)for(const n of row){
      svg.append(svgNode("rect",{class:"project-diagram-node",x:n.x,y:n.y,width:n.w,height:n.h,rx:7}));
      const lines=n.label.split("\n"),text=svgNode("text",{class:"project-diagram-label",x:n.x+n.w/2,
        y:n.y+n.h/2-(lines.length-1)*6.5+4,"text-anchor":"middle"});
      lines.forEach((line,i)=>text.append(svgNode("tspan",{x:n.x+n.w/2,dy:i?13:0},line)));
      svg.append(text);
    }
    figure.append(caption,svg);group.append(figure);
  }
  return group;
}
