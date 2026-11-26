/* Public, read-only curated snapshot of the private Projects card metadata.
 * No account-owned records or private APIs are queried on the public route.
 * The source test enforces parity with the canonical private catalog. */
import {validateProjectTitle} from "./public-projects-title.js";
export const PROJECT_SHOWCASE=Object.freeze([
 {slug:"bootscript",name:"BootScript",kind:"Developer tooling",repository:"lukehanna12/bootscript",status:"in-progress",docs:true},
 {slug:"translucence-lab",name:"Lightwork",kind:"Translucence experiments",repository:"lukehanna12/lightwork",status:"in-progress",docs:true},
 {slug:"github-readme-chrome-extension",name:"ReadMe GLP",kind:"Browser extension",repository:"lukehanna12/reademe-glp",status:"in-progress",docs:true},
 {slug:"chatgpt-chat-save-chrome-extension",name:"ChatStore",kind:"Browser extension",repository:"lukehanna12/chatstore",status:"in-progress",docs:true},
 {slug:"colosseum",name:"Colosseum",kind:"Development platform",repository:"lukehanna12/colosseum"},
 {slug:"apple-hig-reader",name:"Apple HIGs Reader",kind:"Documentation reader",repository:"lukehanna12/apple-higs-reader",status:"in-progress"},
 {slug:"terminal-scalars",name:"Terminal Scalars",kind:"Terminal utility",repository:null},
 {slug:"unicode-plus",name:"Unicode Plus",kind:"Unicode utility",repository:"lukehanna12/unicode-plus",status:"in-progress"},
 {slug:"liquid-plexiglass-26",name:"Liquid Plexiglass 26",kind:"Material research",repository:null},
 {slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null},
 {slug:"apple-adobe-fx",name:"Apple Adobe FX",kind:"Creative tooling",repository:null},
 {slug:"protocol-monitor-pruner",name:"Protocol Monitor Pruner",kind:"Developer utility",repository:"lukehanna12/protocol-monitor-pruner",status:"in-progress"},
 {slug:"app-caviar",name:"App Caviar",kind:"Application",repository:null},
 {slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null},
 {slug:"hidden-functions",name:"Hidden Functions",kind:"Project",repository:null,status:"coming-soon"},
 {slug:"latexcel",name:"LaTeXceL",kind:"Project",repository:null,status:"coming-soon"}
]);
// Public-facing editorial copy lives alongside the curated card catalog.
// Keep proposed features and comparative research distinct from shipped facts.
export const PROJECT_DESCRIPTIONS=Object.freeze({
  "bootscript": "BootScript is built to be the most capable Google Apps Script Chrome extension. Its 97-criterion documented-feature comparison against 21 competing extensions credits BootScript with 66 capabilities, 2.44 times the highest competing count and 8.25 times the competitor median. It enhances Google's native editor with 57 editor theme choices, project-wide navigation, TypeScript intelligence, encrypted recovery, GitHub review workflows, Gemini assistance, collaborative draft editing, HTML previews, execution and deployment tools, and Sheets integration. The development build has passed local engineering tests and is not yet published on the Chrome Web Store.",
  "translucence-lab": "Lightwork is a dedicated laboratory for refraction, exploring in extraordinary detail how light bends, travels through and interacts with translucent materials. It draws on the gold standard of modern knowledge about light, incorporating principles of refraction, absorption, scattering, dispersion and surface behavior into interactive experiments with up to eight independently adjustable lights. Running directly on the Mac's graphics hardware, it provides a detailed environment for studying the optical dynamics behind digital glass; its current simulation uses approximations rather than an exact physical solver.",
  "github-readme-chrome-extension": "ReadMe GLP (ReadMe GitHub Live) is a lightweight live documentation editor for GitHub. It turns GitHub's own editing screen into an editable rendered document, so headings, paragraphs, tables, code and checklists can be changed directly as they appear. Edits flow into GitHub's existing source editor and normal save process, with no separate application, service or account required.",
  "chatgpt-chat-save-chrome-extension": "ChatStore is a comprehensive ChatGPT conversation downloader designed for detailed preservation of individual conversations. Its comparative development research examined 26 alternatives and found none matching its depth of preservation. With reported near-instant, on-demand capture, there is no need to wait for the official account export, which can take up to seven days. Branching messages, available files, resource relationships and source evidence are retained locally, so complex AI projects can be continued rather than merely reread.",
  "colosseum": "Colosseum is an extremely advanced, modern ChatGPT plugin framework that organizes and exposes virtually any tool or reference you could want available to your AI model. Through one secure connection, it brings together local software, cloud services, research, documents and specialized capabilities, supported by a searchable catalog, organized collections, extensible integrations and fine-grained permissions. The framework keeps a wide-ranging supply of resources available to the model while safeguarding actions that change things. Expansion to Claude plugins is planned soon.",
  "apple-hig-reader": "Apple HIGs Reader makes Apple's Human Interface Guidelines searchable and readable, preserving links, images and useful context. More importantly, it demonstrates an exceptionally organized, freely hosted reference architecture on Google Apps Script. Its final form will expose a Model Context Protocol (MCP) server at an /mcp endpoint, using the newer protocol ecosystem to give AI assistants direct access to the guidelines. On-demand conversion and caching keep request volume low, with no separate database or runtime packages and minimal additional restrictions.",
  "terminal-scalars": "Terminal Scalars is a framework for building exceptionally detailed command-line interfaces (CLIs) and interactive terminal user interfaces (TUIs) in Apple's native Terminal. Its foundation is a precise map of the thousands of characters Terminal can display, down to their shapes, spacing, the fonts that produce them and even characters that display nothing. By retaining underlying drawing information rather than relying on screenshots, it aims to give developers extraordinarily fine control over native terminal typography, layout and interactive features.",
  "unicode-plus": "Unicode Plus is the terminal counterpart to LaTeXceL, bringing quick and simple LaTeX notation into everyday command-line work. Supported expressions and symbol commands become readable Unicode text immediately, without a typesetting engine or images. Its verified symbol catalog and reusable converter have broader applications beyond the terminal, with planned integration into other projects that need convenient LaTeX rendering. A companion Mac utility reveals the actual fonts behind the characters you see.",
  "liquid-plexiglass-26": "Liquid Plexiglass 26 aims to be the most accurate reconstruction ever developed of Apple's macOS 26 Tahoe Liquid Glass. Instead of imitating its appearance from screenshots, it reconstructs the mathematical behavior from direct measurements of native graphics internals, recovered shader operations and reproducible tests. The ambition is to translate that evidence into exceptionally faithful Rust and WebGPU implementations, making the material available outside macOS while preserving as much of Apple's actual optical behavior as possible.",
  "3d-liquid-glass-26-swift-package": "3D Liquid Glass is a planned Swift package that will dramatically expand developers' control over the three-dimensional nature of Liquid Glass in macOS 26 and macOS 27. It will build on the exceptionally comprehensive native reconstruction data from Liquid Plexiglass 26 and its planned successor, Liquid Plexiglass 27, together with Lightwork, which should shed light on the underlying dynamics that scaffold digital glass. The goal is to make sophisticated depth, spatial interaction and optical behavior accessible through one coherent library.",
  "apple-adobe-fx": "Apple Adobe FX is a library project intended to provide easy access to the most faithful reconstruction of an Apple Photoshop effect. It will be developed using a very recently open-sourced Adobe Photoshop reconstruction, selected for its reported exceptionally high fidelity. The library will make the effect accessible and reusable while preserving the subtle visual details of the original rather than substituting a conventional approximation.",
  "protocol-monitor-pruner": "Protocol Monitor Pruner is a modern tool built for Chrome's comparatively new and little-known Protocol Monitor, a developer tool that records the detailed messages exchanged inside the browser. Few specialized tools exist for this area. Pruner isolates the messages that matter, preserves their exact original contents and converts enormous exports into compact, searchable archives, entirely on your computer. It makes an unfamiliar but powerful source of browser evidence accessible for investigation and long-term preservation.",
  "app-caviar": "App Caviar is a planned iPhone application that aims to let anyone build and deploy iOS apps directly from their phone, without a computer or programming experience. It will combine a homegrown AI assistant with exceptionally intuitive visual components, guiding creators from an initial idea through building a working app and publishing it within Apple's platform requirements. The ambition is to make the entire process accessible to people who have never written a line of code.",
  "ozoning-board": "Ozoning Board is being developed to become the most versatile in-memory Vite and React application builder ever hosted for free on Google's servers. Its architecture will leverage Google Apps Script's generous usage allowances and newer integrations using the Model Context Protocol (MCP) and Agent2Agent (A2A) protocol, giving AI assistants access to build tools and enabling agents to collaborate on applications. This will distinguish it from competing builders that largely require payment or impose restrictive free-tier limits. Exact build capabilities and usage limits will be specified as development progresses.",
  "hidden-functions": "Hidden Functions is a Google Sheets add-on project that provides an intuitive way to discover, understand and use spreadsheet functions, including the hidden functions that Google does not openly document. It brings together an extensive collection of hidden Google Sheets functions. The project brings those capabilities together with familiar spreadsheet functions in one accessible interface, so users can take advantage of functions that would otherwise be difficult to discover.",
  "latexcel": "LaTeXceL is an Excel add-in and Google Sheets add-on project for incorporating rendered LaTeX directly into workbooks and spreadsheets. In Excel, it makes sophisticated mathematical notation accessible alongside financial models, engineering calculations, scientific analyses and reports: equations, fractions, symbols and complex expressions can be entered in familiar LaTeX syntax rather than assembled manually from characters or images. The same convenient rendered LaTeX integration extends to Google Sheets."
});
// Fail at catalog import/build, not after an overlong title has rendered.
PROJECT_SHOWCASE.forEach(project=>validateProjectTitle(project.name));
const PHOTO_ROUTES=Object.freeze([
 "projects","colosseum/readme","colosseum/utilities","colosseum/collections",
 "colosseum/providers","colosseum/permissions","colosseum/diagnostics","settings"
]);
// Preserve the curated order within each status group. A linked repository
// does not silently promote an explicitly In Progress project to Active.
export function projectShowcaseStatus(project){
 if(project.status==="in-progress")return "In Progress";
 if(project.status==="coming-soon")return "Coming Soon";
 return project.repository||project.docs===true?"Active":"Coming Soon";
}
const STATUS_ORDER=Object.freeze({"Active":0,"In Progress":1,"Coming Soon":2});
export function sortProjectShowcase(projects){
 return [...projects].sort((a,b)=>STATUS_ORDER[projectShowcaseStatus(a)]-STATUS_ORDER[projectShowcaseStatus(b)]);
}
// Stable per-project choices. Unassigned items keep their current marker and wallpaper.
// Existing published artwork remains linked to original sources; user-supplied Terminal Scalars art is a local optimized asset.
export const PROJECT_CARD_ICONS=Object.freeze({
  "colosseum":"colosseum-lucide.v2",
  "bootscript":"paint-roller",
  "translucence-lab":"lightwork.v3",
  "github-readme-chrome-extension":"file-pen",
  "chatgpt-chat-save-chrome-extension":"folder-bookmark",
  "terminal-scalars":"terminal-scalars.v3",
  "unicode-plus":"unicode-plus.v2",
  "liquid-plexiglass-26":"lens",
  "3d-liquid-glass-26-swift-package":"move-3d",
  "apple-hig-reader":"apple-higs-reader.v4",
  "apple-adobe-fx":"apple-adobe-fx.v2",
  "protocol-monitor-pruner":"protocol-monitor-pruner.v2",
  "app-caviar":"opacity",
  "ozoning-board":"treehouse-ozoning.v4",
  "hidden-functions":"hidden-functions",
  "latexcel":"latexcel"
});
/* One public source for project icon asset URLs. Both the Projects cards
 * and the Home mosaic reference this same lookup and exact same SVG file.
 * Styling owns black-on-Home vs white-on-Projects; SVGs stay unmodified. */
export function publicProjectIconSource(slug){
 const icon=PROJECT_CARD_ICONS[slug];
 return icon?"/assets/project-icons/"+icon+".svg":null;
}
export const PROJECT_CARD_IMAGES=Object.freeze({
  "bootscript":"/assets/project-art/bootscript-polo-ponies.v1.webp",
  "translucence-lab":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg/960px-The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg",
  "github-readme-chrome-extension":"https://upload.wikimedia.org/wikipedia/commons/f/f0/Monet_-_Valley_of_the_Petite_Creuse%2C_1889.jpg",
  "chatgpt-chat-save-chrome-extension":"https://gagosian.com/media/images/exhibitions/2023/takashi-murakami-understanding-the-new-cognitive-domain/c0V9eYeBTMHL_2400x2400.jpg",
  "colosseum":"https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg/960px-Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg",
  "apple-hig-reader":"https://thisishell-assets.s3.amazonaws.com/uploads/interview/image/784/990RiccardoManzotti.jpg",
  "terminal-scalars":"/assets/project-art/terminal-scalars-liquid-symmetry.v2.webp",
  "app-caviar":"/assets/project-art/app-caviar-source.v2.webp",
  "hidden-functions":"/assets/project-art/hidden-functions-piranesi.v1.webp",
  "latexcel":"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg",
  "unicode-plus":"https://d3d00swyhr67nd.cloudfront.net/w1200h1200/collection/NTI/DYP/NTI_DYP_453771-001.jpg",
  "protocol-monitor-pruner":"https://most-famous-paintings.com/media-resize/960/artworks/images-full/76/18/76183ece8e74b1c3404d66a0bc2e70a6.jpg.webp",
  "liquid-plexiglass-26":"https://museum.bucknell.edu/files/2020/07/Warhol_Glasses-scaled.jpg",
  "ozoning-board":"/assets/project-art/ozoning-board-el-khasne.v1.webp"
});

const PUBLIC_WALLPAPER_FALLBACKS=Object.freeze([
 "302138334c5973c7fed71a26037e19a8b94fce8433fecce8bad1454474c36a08.webp",
 "ade03e6d5958ddb9e1e5098ad67d46b7f4c801057aa77c85510d846ef8f75091.png",
 "c49181be2b93fe24a44774a7c6f4253f23ec3bf0cfc369a318e420d7418f9eb2.jpg",
 "dcb3d4f1e42bf3aebab2186768a598d17a8aad76e9620a150e268938eee01441.jpg",
 "65dbc89fe23cd47bbcdb76d419fde8168f93e4b6af9f70c533732cf7ee6015c7.jpg",
 "8f54a531db0e7382a7a18c27e0daf5283bfaa8e655fae9da460f21242a3a1ec6.jpg",
 "3203fcc740876cc48c489699ee3f00e5c069fa9a3825cc7afaf2680b836c22cd.jpg",
 "ca6bf0317dcb6806a536f5d41b8c54cf34446a196e8a5f7265dc5f10c7f3b957.avif"
]);
export function publicProjectImage(project,index){
 return PROJECT_CARD_IMAGES[project.slug]||
   "/wallpapers/"+PUBLIC_WALLPAPER_FALLBACKS[index%PUBLIC_WALLPAPER_FALLBACKS.length];
}

/* GPU image uploads require origin-clean decoded artwork. The remote
 * entries use a narrow slug-only first-party route, not an arbitrary proxy. */
export function publicProjectArtworkSource(project,index){
 const source=publicProjectImage(project,index);
 return source.startsWith("https://")?"/project-artwork/"+project.slug:source;
}

/* Public URLs use names rather than historical internal asset identifiers. */
export function publicProjectSlug(project){
 return project.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
export function publicProjectHref(project){return "/projects#"+publicProjectSlug(project);}
export function projectFromPublicHash(hash){
 let slug;
 try{slug=decodeURIComponent(String(hash||"").replace(/^#/,"")).toLowerCase();}
 catch{return null;}
 if(!slug)return null;
 return PROJECT_SHOWCASE.find(project=>publicProjectSlug(project)===slug||project.slug===slug)||null;
}
