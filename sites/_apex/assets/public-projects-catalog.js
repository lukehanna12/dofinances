/* Public, read-only curated snapshot of the private Projects card metadata.
 * No account-owned records or private APIs are queried on the public route.
 * The source test enforces parity with the canonical private catalog. */
import {validateProjectTitle} from "./public-projects-title.js";
import {PROJECT_ICON_REVISIONS} from "./project-icon-revisions.js";
export const PROJECT_SHOWCASE=Object.freeze([
 {slug:"bootscript",name:"BootScript",kind:"Developer tooling",repository:"lukehanna12/bootscript",status:"review",docs:true},
 {slug:"lightworks",name:"Lightworks",kind:"Translucence experiments",repository:"lukehanna12/lightworks",status:"review",docs:true},
 {slug:"github-readme-chrome-extension",name:"ReadMe GLP",kind:"Browser extension",repository:"lukehanna12/reademe-glp",status:"review",docs:true},
 {slug:"chatgpt-chat-save-chrome-extension",name:"ChatStore",kind:"Browser extension",repository:"lukehanna12/chatstore",status:"in-progress",docs:true},
 {slug:"colosseum",name:"Colosseum",kind:"Development platform",repository:"lukehanna12/colosseum",status:"coming-soon"},
 {slug:"apple-hig-reader",name:"Apple HIGs Reader",kind:"Documentation reader",repository:"lukehanna12/apple-higs-reader",status:"review"},
 {slug:"terminal-scalars",name:"Terminal Scalars",kind:"Terminal utility",repository:null},
 {slug:"unicode-plus",name:"Unicode Plus",kind:"Unicode utility",repository:"lukehanna12/unicode-plus",status:"review"},
 {slug:"liquid-plexiglass-26",name:"Liquid Plexiglass 26",kind:"Material research",repository:null,status:"in-progress"},
 {slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null,status:"in-progress"},
 {slug:"apple-adobe-fx",name:"Apple Adobe FX",kind:"Creative tooling",repository:null},
 {slug:"protocol-monitor-pruner",name:"Protocol Monitor Pruner",kind:"Chrome extension and CLI",repository:"lukehanna12/protocol-monitor-pruner",status:"review"},
 {slug:"app-caviar",name:"App Caviar",kind:"Application",repository:null},
 {slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null,status:"review"},
 {slug:"hidden-functions",name:"Hidden Functions",kind:"Project",repository:null,status:"in-progress"},
 {slug:"latexcel",name:"LaTeXceL",kind:"Project",repository:null,status:"in-progress"}
]);
// Public-facing editorial copy lives alongside the curated card catalog.
// Keep proposed features and comparative research distinct from shipped facts.
export const PROJECT_DESCRIPTIONS=Object.freeze({
  "bootscript": "BootScript is built to be the most capable Google Apps Script Chrome extension. Its 97-criterion documented-feature comparison against 21 competing extensions credits BootScript with 66 capabilities, 2.44 times the highest competing count and 8.25 times the competitor median. It enhances Google's native editor with 57 editor theme choices, project-wide navigation, TypeScript intelligence, encrypted recovery, GitHub review workflows, Gemini assistance, collaborative draft editing, HTML previews, execution and deployment tools, and Sheets integration. The development build has passed local engineering tests and is not yet published on the Chrome Web Store.",
  "lightworks": "Lightworks is a native macOS application and independent command-line interface (CLI) for exploring how light bends, travels through and interacts with translucent materials. Drawing on the gold standard of modern knowledge about light, it brings refraction, absorption, scattering, dispersion and surface behavior into interactive experiments with up to eight independently adjustable lights. Both products share a Metal rendering engine, portable scenes and high-resolution PNG export, while the CLI also provides analytic optical calculations and reproducible experiments. The visual simulation uses physically inspired approximations rather than an exact physical solver.",
  "github-readme-chrome-extension": "ReadMe GLP (ReadMe GitHub Live) is a lightweight live documentation editor for GitHub, delivered as a Chrome extension. It turns GitHub's own editing screen into an editable rendered document, so headings, paragraphs, tables, code and checklists can be changed directly as they appear. Edits flow into GitHub's existing source editor and normal save process, with no separate application, service or account required.",
  "chatgpt-chat-save-chrome-extension": "ChatStore is a browser extension and comprehensive ChatGPT conversation downloader designed for detailed preservation of individual conversations. Its comparative development research examined 26 alternatives and found none matching its depth of preservation. With reported near-instant, on-demand capture, there is no need to wait for the official account export, which can take up to seven days. Branching messages, available files, resource relationships and source evidence are retained locally, so complex AI projects can be continued rather than merely reread.",
  "colosseum": "Colosseum is an extremely advanced, modern development platform with a web application, a command-line interface (CLI) and a ChatGPT plugin framework that organizes and exposes virtually any tool or reference you could want available to your AI model. Through one secure connection, it brings together local software, cloud services, research, documents and specialized capabilities, supported by a searchable catalog, organized collections, extensible integrations and fine-grained permissions. The framework keeps a wide-ranging supply of resources available to the model while safeguarding actions that change things. Expansion to Claude plugins is planned soon.",
  "apple-hig-reader": "Apple HIGs Reader makes Apple's Human Interface Guidelines searchable and readable, preserving source links, media references and useful context. It demonstrates a freely hosted reference architecture on Google Apps Script, implementing Model Context Protocol (MCP) directly through a native /exec/mcp route and an /exec compatibility fallback. AI assistants can discover topics, search navigation metadata and retrieve paginated Markdown with attribution and rendering diagnostics. On-demand conversion and caching keep request volume low. A single Google Apps Script project hosts the entire reader, without external infrastructure, databases or paid APIs.",
  "terminal-scalars": "Terminal Scalars is a library for building exceptionally detailed command-line interfaces (CLIs) and interactive terminal user interfaces (TUIs) in Apple's native Terminal. Its foundation is a precise map of the thousands of characters Terminal can display, down to their shapes, spacing, the fonts that produce them and even characters that display nothing. By retaining underlying drawing information rather than relying on screenshots, it gives developers extraordinarily fine control over native terminal typography, layout and interactive features. Scripts are also included for the purpose of deploying your own customizable Google-hosted MCP server using Google Apps Script; all you need is a Google Drive account.",
  "unicode-plus": "Unicode Plus is the terminal counterpart to LaTeXceL, a command-line interface (CLI) bringing quick and simple LaTeX notation into everyday command-line work. Supported expressions and symbol commands become readable Unicode text immediately, without a typesetting engine or images. Its verified symbol catalog and reusable converter have broader applications beyond the terminal, with planned integration into other projects that need convenient LaTeX rendering. A companion Mac utility reveals the actual fonts behind the characters you see.",
  "liquid-plexiglass-26": "Liquid Plexiglass 26 is the most faithful reconstruction of macOS 26 Tahoe Liquid Glass on the internet. It includes the entire public interface for macOS 26 Tahoe Liquid Glass and is 100% resolution independent, preserving continuous geometry and optical behavior at any scale or level of magnification. Instead of imitating its appearance from screenshots, it reconstructs the mathematical behavior from direct measurements of native graphics internals, recovered shader operations and reproducible tests. Its Rust and WebGPU libraries bring the material outside macOS while preserving the intricacies of Apple's native optical behavior.",
  "3d-liquid-glass-26-swift-package": "3D Liquid Glass is a planned Swift package that will dramatically expand developers' control over the three-dimensional nature of Liquid Glass in macOS 26 and macOS 27. It will build on the exceptionally comprehensive native reconstruction data from Liquid Plexiglass 26 and its planned successor, Liquid Plexiglass 27, together with Lightworks, which should shed light on the underlying dynamics that scaffold digital glass. The goal is to make sophisticated depth, spatial interaction and optical behavior accessible through one coherent library.",
  "apple-adobe-fx": "Apple Adobe FX is a library project intended to provide easy access to the most faithful reconstruction of an Apple Photoshop effect. It will be developed using a very recently open-sourced Adobe Photoshop reconstruction, selected for its reported exceptionally high fidelity. The library will make the effect accessible and reusable while preserving the subtle visual details of the original rather than substituting a conventional approximation.",
  "protocol-monitor-pruner": "Protocol Monitor Pruner is a project for Chrome's comparatively new and little-known Protocol Monitor, with a polished Chrome extension in development for direct in-browser control and an independent command-line interface (CLI) for local control. Few specialized tools exist for this area. The CLI already isolates selected messages, preserves their exact original JSON bytes and converts large exports into compact, searchable archives on your computer. Both implementations will live in one repository, sharing code where appropriate while remaining independently usable alternatives for investigation and long-term preservation.",
  "app-caviar": "App Caviar is a planned iPhone application that aims to let anyone build and deploy iOS apps directly from their phone, without a computer or programming experience. It will combine a homegrown AI assistant with exceptionally intuitive visual components, guiding creators from an initial idea through building a working app and publishing it within Apple's platform requirements. The ambition is to make the entire process accessible to people who have never written a line of code.",
  "ozoning-board": "Ozoning Board is a lightweight MCP for building Vite and React applications entirely in-memory, hosted entirely for free on Google servers. Its architecture leverages Google Apps Script's generous usage allowances, backwards-compatible Agent2Agent (A2A) protocols, and recently expanded¹ support for self-contained WASM loader functions to optimize highly efficient Server-Side Rendering (SSR) and cheaply provide AI assistants with both extensive access to build tools and the option of remembered collaborative environments. It rivals the vast majority of cloud-compute tools, since nearly all require payment or impose restrictive free-tier limits; this implementation only requires a user to have a Google Drive account.",
  "hidden-functions": "Hidden Functions is a Google Sheets add-on project that provides an intuitive way to discover, understand and use spreadsheet functions, including the hidden functions that Google does not openly document. It brings together an extensive collection of hidden Google Sheets functions. The project brings those capabilities together with familiar spreadsheet functions in one accessible interface, so users can take advantage of functions that would otherwise be difficult to discover.",
  "latexcel": "LaTeXceL is an Excel add-in and Google Sheets add-on project for incorporating rendered LaTeX directly into workbooks and spreadsheets. In Excel, it makes sophisticated mathematical notation accessible alongside financial models, engineering calculations, scientific analyses and reports: equations, fractions, symbols and complex expressions can be entered in familiar LaTeX syntax rather than assembled manually from characters or images. The same convenient rendered LaTeX integration extends to Google Sheets."
});
// Footnotes are separate from the selectable editorial paragraph.
export const PROJECT_DESCRIPTION_FOOTNOTES=Object.freeze({
  "ozoning-board":"¹ expanded June 2026"
});
// Fail at catalog import/build, not after an overlong title has rendered.
PROJECT_SHOWCASE.forEach(project=>validateProjectTitle(project.name));
const PHOTO_ROUTES=Object.freeze([
 "projects","colosseum/readme","colosseum/utilities","colosseum/collections",
 "colosseum/providers","colosseum/permissions","colosseum/diagnostics","settings"
]);
// Preserve the curated order within each status group. A linked repository
// does not silently promote an explicitly Review or In Progress project to Ready.
export function projectShowcaseStatus(project){
 if(project.status==="ready")return "Ready";
 if(project.status==="review")return "Review";
 if(project.status==="in-progress")return "In Progress";
 if(project.status==="coming-soon")return "Coming Soon";
 return project.repository||project.docs===true?"Ready":"Coming Soon";
}
const STATUS_ORDER=Object.freeze({"Ready":0,"Review":1,"In Progress":2,"Coming Soon":3});
export function sortProjectShowcase(projects){
 return [...projects].sort((a,b)=>STATUS_ORDER[projectShowcaseStatus(a)]-STATUS_ORDER[projectShowcaseStatus(b)]);
}
// Stable per-project choices. Unassigned items keep their current marker and wallpaper.
// Existing published artwork remains linked to original sources; Terminal Scalars uses the full-resolution gallery photograph of P3010_8.
export const PROJECT_CARD_ICONS=Object.freeze({
  "colosseum":"colosseum-lucide.v2",
  "bootscript":"paint-roller",
  "lightworks":"lightworks.v3",
  "github-readme-chrome-extension":"readme-glp.v2",
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
 // A replaced SVG may retain its stable stem. A content-based URL prevents
 // the browser from reusing an older decoded icon from another route.
 return icon?"/assets/project-icons/"+icon+".svg?v="+PROJECT_ICON_REVISIONS[icon]:null;
}
export const PROJECT_CARD_IMAGES=Object.freeze({
  "bootscript":"/assets/project-art/bootscript-polo-ponies.v1.webp",
  "lightworks":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg/960px-The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg",
  "github-readme-chrome-extension":"https://upload.wikimedia.org/wikipedia/commons/f/f0/Monet_-_Valley_of_the_Petite_Creuse%2C_1889.jpg",
  // Katsushika Hokusai, A merchant making up the account, public domain (Wikimedia Commons).
  "chatgpt-chat-save-chrome-extension":"/assets/project-art/chatstore-hokusai-merchant.v1.webp",
  // User-provided photograph of a bronze cowboy sculpture.
  "apple-adobe-fx":"/assets/project-art/apple-adobe-fx-bronze-sculpture.v2.jpg",
  "colosseum":"https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg/960px-Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg",
  "apple-hig-reader":"https://thisishell-assets.s3.amazonaws.com/uploads/interview/image/784/990RiccardoManzotti.jpg",
  // Source: https://dam-media.fra1.digitaloceanspaces.com/Mohr2020_22_P3010_8_b0152949c4.jpg
  "terminal-scalars":"/assets/project-art/terminal-scalars-liquid-symmetry.v3.webp",
  "app-caviar":"/assets/project-art/app-caviar-source.v2.webp",
  // Norman Rockwell, Shadow Artist, 1920. Smithsonian American Art Museum exhibition.
  "hidden-functions":"/assets/project-art/hidden-functions-rockwell-shadow-artist.v3.jpg",
  "latexcel":"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg",
  "unicode-plus":"https://d3d00swyhr67nd.cloudfront.net/w1200h1200/collection/NTI/DYP/NTI_DYP_453771-001.jpg",
  "protocol-monitor-pruner":"https://most-famous-paintings.com/media-resize/960/artworks/images-full/76/18/76183ece8e74b1c3404d66a0bc2e70a6.jpg.webp",
  // Rembrandt, 1633; Isabella Stewart Gardner Museum, PD-Art.
  // https://commons.wikimedia.org/wiki/File:Rembrandt_van_Rijn_-_Christ_in_the_Storm_on_the_Sea_of_Galilee_-_P21s24_-_private_collection.jpg
  "liquid-plexiglass-26":"/assets/project-art/liquid-plexiglass-26-rembrandt-storm.v2.webp",
  // Juan Sánchez Cotán, Museo de Bellas Artes de Granada, PD-Art.
  // https://commons.wikimedia.org/wiki/File:MBAGR-bodegoncardo.jpg
  "3d-liquid-glass-26-swift-package":"/assets/project-art/3d-liquid-glass-cotan-cardo.v2.webp",
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
