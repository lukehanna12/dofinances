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
  "bootscript": "BootScript aims to become the most advanced extension ever built for Google Apps Script, transforming Google's own editor into a fully refined development environment without requiring a separate application. Four carefully crafted themes, extensive editing controls, smarter navigation and a reversible focus mode already put sophisticated customization within reach. Google still handles your projects, execution and deployments, with no extra account, analytics or source uploads.",
  "translucence-lab": "Lightwork is a dedicated laboratory for refraction, exploring in extraordinary detail how light bends, travels through and interacts with translucent materials. It brings together contemporary optical science, including absorption, scattering, dispersion, surface roughness and the behavior of multiple light sources, in an interactive Mac application. Its research ambition is to incorporate the gold standard of modern knowledge about light into increasingly faithful digital experiments, rather than settle for conventional visual approximations.",
  "github-readme-chrome-extension": "ReadMe GLP is designed to be the most lightweight live documentation editor built for GitHub. It turns GitHub's own editing screen into a live, editable document, so headings, paragraphs, tables, code and checklists can be changed directly as they appear. Edits flow into GitHub's existing source editor and normal save process, eliminating the need for a separate editor, service or account while preserving the structure of the original document.",
  "chatgpt-chat-save-chrome-extension": "ChatStore aims to deliver the most capable ChatGPT conversation downloader, with near-instant, on-demand capture instead of waiting for an official account export that can take up to seven days. Its development research across 26 alternative projects found none matching its depth of conversation preservation. Designed to surpass even the official export in per-conversation detail, it preserves branching messages, available files, resource relationships and source evidence so complex AI projects can be resumed, not merely reread. Everything stays on your computer.",
  "colosseum": "Colosseum is a modern, exceptionally ambitious ChatGPT plugin framework designed to organize and expose virtually any tool or reference you could want available to your AI model. One secure connection brings together local software, cloud services, research, documents and specialized capabilities, with fine-grained permissions and safeguards for actions that change things. Its ambition is to give AI a continuously organized, extensible workspace rather than a fixed set of integrations. Expansion to Claude plugins is planned next.",
  "apple-hig-reader": "Apple HIGs Reader makes Apple's extensive Human Interface Guidelines searchable and readable for people and AI assistants, preserving original links, images and useful context. Its greater achievement is the architecture: an exceptionally organized reference service running entirely on Google's free Apps Script infrastructure, without a separate server, external database or runtime packages. On-demand conversion and caching are designed to minimize requests, making the most of Google's usage limits with as few additional restrictions as possible.",
  "terminal-scalars": "Terminal Scalars is a research tool for mapping the thousands of individual characters that Apple's Terminal can display, down to their exact shapes, spacing and the fonts that produce them. By retaining the underlying drawing information rather than relying on screenshots, the project aims to create a precise, machine-readable atlas of a Mac's text-rendering environment, including characters that display nothing. It provides a foundation for reconstructing and understanding how terminal text actually appears.",
  "unicode-plus": "Unicode Plus brings the convenience of LaTeXceL to the terminal and beyond. Type supported LaTeX expressions, mathematical notation or symbol commands and get readable Unicode characters immediately, without launching a typesetting engine or generating images. Its verified symbol catalog and reusable conversion engine are intended to power quick, simple LaTeX integrations in other projects, while a companion Mac utility reveals the actual fonts behind the characters you see.",
  "liquid-plexiglass-26": "Liquid Plexiglass 26 aims to be the most accurate reconstruction ever developed of Apple's macOS 26 Tahoe Liquid Glass. Instead of imitating its appearance from screenshots, it reconstructs the mathematical behavior from direct measurements of native graphics internals, recovered shader operations and reproducible tests. The ambition is to translate that evidence into exceptionally faithful Rust and WebGPU implementations, making the material available outside macOS while preserving as much of Apple's actual optical behavior as possible.",
  "3d-liquid-glass-26-swift-package": "3D Liquid Glass is a planned Swift package that will dramatically expand developers' control over the three-dimensional nature of Liquid Glass in macOS 26 and macOS 27. It will build on the exceptionally comprehensive native reconstruction data from Liquid Plexiglass 26 and its planned successor, Liquid Plexiglass 27, together with Lightwork, which should shed light on the underlying dynamics that scaffold digital glass. The goal is to make sophisticated depth, spatial interaction and optical behavior accessible through one coherent library.",
  "apple-adobe-fx": "Apple Adobe FX is a planned library that aims to provide easy access to the most faithful reconstruction of the Apple Photoshop effect its creator considers the company's most popular. It will build on a recently open-sourced Adobe Photoshop reconstruction selected for its reported exceptional fidelity, making that sophisticated effect readily reusable in other creative projects while preserving the subtle details that distinguish it from a rough imitation.",
  "protocol-monitor-pruner": "Protocol Monitor Pruner tackles one of the newer and still underexplored areas of Chrome's developer tools: Protocol Monitor, which records the detailed messages exchanged inside the browser. Few specialized tools exist for working with these records. This local utility lets researchers isolate the messages that matter, preserve their exact original contents and convert enormous exports into compact, searchable archives, making an unfamiliar but powerful source of browser evidence accessible and practical.",
  "app-caviar": "App Caviar is a planned iPhone application that aims to let anyone build and deploy iOS apps directly from their phone, without a computer or programming experience. It will combine a homegrown AI assistant with exceptionally intuitive visual components, guiding creators from an initial idea through building a working app and publishing it within Apple's platform requirements. The ambition is to make the entire process accessible to people who have never written a line of code.",
  "ozoning-board": "Ozoning Board aims to become the most versatile in-memory Vite and React application builder ever hosted for free on Google's servers. It will bring the tools behind modern websites into one workspace, using Google Apps Script's generous but finite usage allowances instead of a paid build server. Its ambition is to offer a powerful alternative to builders that require subscriptions or impose tight free-tier restrictions, with the exact build capabilities and usage limits to be established.",
  "hidden-functions": "Hidden Functions is a planned Google Sheets add-on that aims to provide the largest collection of hidden Google Sheets functions available anywhere on the internet. Its intuitive interface will make both familiar and undisclosed spreadsheet functions easy to discover, understand and use, giving everyday spreadsheet users access to capabilities that would otherwise be difficult to find.",
  "latexcel": "LaTeXceL is a planned Excel add-in and Google Sheets add-on that brings rendered LaTeX notation directly into workbooks and spreadsheets. In Excel, it aims to make it effortless to place precise mathematical equations, scientific notation, symbols and complex expressions alongside financial models, engineering calculations and reports, using familiar LaTeX syntax instead of manually assembling characters or images. The same simple approach will extend to Google Sheets, making professional mathematical notation a natural part of spreadsheet workflows."
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
