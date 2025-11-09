export const parseOPML = (xmlText: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const outlines = doc.querySelectorAll('outline[xmlUrl], outline[xmlurl]');
  const urls: string[] = [];
  
  outlines.forEach(outline => {
    const url = outline.getAttribute('xmlUrl') || outline.getAttribute('xmlurl');
    if (url && url.startsWith('https://')) {
      urls.push(url);
    }
  });
  
  return urls;
};