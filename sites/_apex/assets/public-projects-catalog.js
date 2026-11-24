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
  "bootscript": "BootScript transforms Google's built-in Apps Script editor into a highly customizable development environment without making you leave the page. Four carefully designed themes, extensive editing preferences, smarter navigation and a reversible focus mode bring the feel of a dedicated code editor to Google's own workspace. Your projects, execution and deployments stay with Google, with no extra account, analytics or source uploads.",
  "translucence-lab": "Lightwork is a real-time laboratory for exploring how light travels through translucent materials. Shape glass, adjust refraction, absorption, scattering and color separation, then position up to eight independently controlled lights to see how they interact. Built to run directly on the Mac's graphics hardware, it brings a remarkable range of modern optical principles into one interactive scene, with the aim of making the behavior of digital glass easier to understand and recreate.",
  "github-readme-chrome-extension": "ReadMe GLP turns GitHub's own documentation editor into a remarkably lightweight live editing experience. Instead of wrestling with formatting codes or switching between a source editor and a preview, you can edit the rendered document directly, including headings, text, tables and checklists. Changes flow back into GitHub's existing editor, ready to save through its normal workflow, with no separate service or account.",
  "chatgpt-chat-save-chrome-extension": "ChatStore captures individual ChatGPT conversations on demand, without waiting for the official account-wide export, which can take up to seven days to arrive. Its development research across 26 alternative projects found none matching its depth of conversation preservation. It retains branching conversations, available files, resource relationships and the evidence behind each record, making it possible to resume complex work with an AI rather than merely save a transcript. Everything stays on your computer.",
  "colosseum": "Colosseum is an advanced framework for giving ChatGPT access to a carefully organized collection of tools, software, documents and reference material, wherever they live. A single connection can bring together cloud services, local applications, research archives and specialized capabilities, with precise permissions and safeguards for actions that change things. Its goal is to make an AI assistant genuinely useful across an entire digital workspace; support for Claude is planned next.",
  "apple-hig-reader": "Apple HIGs Reader makes Apple's extensive Human Interface Guidelines searchable and readable through a remarkably compact service hosted on Google Apps Script. It retrieves the original guidance, preserves links, images and other useful context, and converts articles into a format that people and AI assistants can work with. It demonstrates how a thoughtfully designed, cached reference service can run on Google's free infrastructure with minimal dependencies and within its usage allowances.",
  "terminal-scalars": "Terminal Scalars is a research tool for mapping the thousands of individual characters that Apple's Terminal can display, down to their exact shapes, spacing and the fonts that produce them. By retaining the underlying drawing information rather than relying on screenshots, the project aims to create a precise, machine-readable atlas of a Mac's text-rendering environment, including characters that display nothing. It provides a foundation for reconstructing and understanding how terminal text actually appears.",
  "unicode-plus": "Unicode Plus brings the expressive power of LaTeX notation to ordinary terminal text. Type a supported mathematical expression or symbol command and get readable Unicode characters immediately, without launching a typesetting engine or creating an image. Its verified symbol catalog and reusable converter are designed to make mathematical writing just as effortless in other applications, while a companion Mac tool explores the actual fonts behind the characters you see.",
  "liquid-plexiglass-26": "Liquid Plexiglass 26 is an ambitious effort to reconstruct the mathematical behavior of Apple's Liquid Glass in macOS 26 Tahoe with exceptional fidelity. Rather than imitate its appearance from screenshots, it builds on direct measurements of native graphics internals, recovered shader operations and reproducible mathematical tests. The goal is to translate this evidence into reusable Rust and WebGPU implementations, bringing a deeply faithful version of Apple's material to environments beyond macOS.",
  "3d-liquid-glass-26-swift-package": "3D Liquid Glass is a planned Swift package intended to give Apple developers finer control over the three-dimensional behavior of Liquid Glass in macOS 26 and 27. It will draw on the extensive native reconstruction in Liquid Plexiglass 26, its planned macOS 27 successor, and the Lightwork laboratory to shed light on the physical principles behind digital glass. The goal is to make sophisticated depth, material and optical behavior accessible through a coherent development library.",
  "apple-adobe-fx": "Apple Adobe FX is a planned library for making a highly faithful reconstruction of Apple's signature Photoshop effect easy to use in other creative projects. Building on the recently open-sourced reconstruction of that effect, it aims to turn a complex visual process into a reusable, accessible library, preserving the subtle details that make the original recognizable rather than substituting a rough approximation.",
  "protocol-monitor-pruner": "Protocol Monitor Pruner tackles a surprisingly underexplored problem in Chrome's relatively new Protocol Monitor, a developer tool that records the detailed messages exchanged inside the browser. It lets researchers isolate the records that matter, retain their exact original contents and turn enormous exports into compact, searchable archives. Running entirely locally, it makes a specialized source of browser evidence far easier to investigate, preserve and share.",
  "app-caviar": "App Caviar is a planned iPhone application for creating and deploying iOS apps without needing a computer or knowing how to code. It will combine a custom-built AI assistant with intuitive visual components to help people turn ideas into working applications directly on their phones. The ambition is to make the entire app-building experience accessible to a new generation of creators, with publishing designed around Apple's platform requirements.",
  "ozoning-board": "Ozoning Board is a planned, highly versatile web application builder that aims to run entirely in memory on Google's freely hosted Apps Script infrastructure. It will bring the flexibility of Vite and React, the tools behind many modern websites, into a convenient workspace without a paid build server. The goal is to make powerful web development broadly accessible within Google's generous but finite usage allowances, with the exact build capabilities and limits to be established.",
  "hidden-functions": "Hidden Functions is a planned Google Sheets add-on that makes powerful spreadsheet functions easier to discover, understand and use. Beyond the familiar functions documented by Google, it aims to assemble the most comprehensive publicly accessible collection of hidden functions, paired with a simple interface that helps people explore what their spreadsheets can really do.",
  "latexcel": "LaTeXceL is a planned Excel add-in and Google Sheets add-on for bringing beautifully rendered mathematical notation into workbooks. Create formulas, scientific expressions, symbols and structured equations alongside calculations, financial models or technical reports, without assembling them manually from scattered characters or images. The Excel experience will focus on incorporating editable notation into existing workbook workflows, with the same convenient approach available in Google Sheets."
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
