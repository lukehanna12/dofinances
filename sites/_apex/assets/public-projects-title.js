/* Public card title typography; independent of glass material. Count
 * Unicode grapheme clusters, including spaces. Wrap only between words. */
export const MAX_PROJECT_TITLE_LENGTH=30;
export const MAX_PROJECT_TITLE_LINE_LENGTH=15;
const segmenter=new Intl.Segmenter(undefined,{granularity:"grapheme"});
export function projectTitleLength(text){
 return Array.from(segmenter.segment(text)).length;
}
export function validateProjectTitle(title){
 if(typeof title!=="string"||!title||title.trim()!==title||/[^\S ]| {2,}/u.test(title))
  throw new TypeError("Project title must be nonempty with single spaces between words");
 if(projectTitleLength(title)>MAX_PROJECT_TITLE_LENGTH)
  throw new RangeError("Project title exceeds 30 characters");
 if(title.split(" ").some(word=>projectTitleLength(word)>MAX_PROJECT_TITLE_LINE_LENGTH))
  throw new RangeError("Project title has a word exceeding 15 characters");
 return title;
}
export function projectTitleLines(title){
 validateProjectTitle(title);
 const lines=[];
 let current="";
 for(const word of title.split(" ")){
  const candidate=current?current+" "+word:word;
  if(projectTitleLength(candidate)>MAX_PROJECT_TITLE_LINE_LENGTH){
   lines.push(current);current=word;
  }else current=candidate;
 }
 lines.push(current);
 return lines;
}
export function projectTitleWidthShare(length){
 if(!Number.isInteger(length)||length<1||length>MAX_PROJECT_TITLE_LINE_LENGTH)
  throw new RangeError("Title line length must be 1–15 characters");
 // Linear interpolation through 9 → 55%, 15 → 80%. For a wrapped title,
 // the longest line sets the target; short trailing words never enlarge.
 return Math.max(.25,.55+(length-9)*(.25/6));
}
export function projectTitleRatio(lines,widths,referenceSize=100){
 if(lines.length!==widths.length||!lines.length||
    !Number.isFinite(referenceSize)||referenceSize<=0||
    widths.some(width=>!Number.isFinite(width)||width<=0))
  throw new RangeError("Invalid title font measurements");
 const longest=Math.max(...lines.map(projectTitleLength));
 return referenceSize*projectTitleWidthShare(longest)/Math.max(...widths);
}
export function mountProjectTitleSizing(root){
 // Measure real DOM glyph advances including kerning and letter spacing,
 // not a monospaced approximation. Container units track the live card
 // width during viewport changes, expansion, contraction and ghost cloning.
 const titles=[...root.querySelectorAll(".project-showcase-title")];
 const measure=()=>{
  for(const title of titles){
   const lines=[...title.querySelectorAll(".project-showcase-title-line")];
   title.style.fontSize="100px";
   const widths=lines.map(line=>line.getBoundingClientRect().width);
   title.style.removeProperty("font-size");
   if(widths.every(w=>w>0)){
    const ratio=projectTitleRatio(lines.map(line=>line.textContent),widths);
    title.style.setProperty("--project-title-ratio",String(ratio));
   }
  }
 };
 measure();
 document.fonts?.ready.then(()=>{if(root.isConnected)measure();});
}
