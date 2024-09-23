import axios from 'axios';
import * as cheerio from 'cheerio';

interface Font {
  family: string;
  variants: string;
  letterSpacings: string;
  fontWeight: string;
  url: string;
}

interface PrimaryButton {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  textDecoration: string;
  textAlign: string;
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
}

interface ScraperResponse {
  fonts: Font[];
  primaryButton: PrimaryButton;
}

function cleanFontFamily(fontFamily: string): string {
  return fontFamily.replace(/['"]/g, '').trim().split(',')[0].trim();
}

function extractFonts($: cheerio.CheerioAPI): Font[] {
  const fontMap = new Map<string, Font>();

  // Function to add or update a font in the map
  function addFont(family: string, weight: string = '400', letterSpacing: string = 'normal') {
    const cleanFamily = cleanFontFamily(family);
    if (!fontMap.has(cleanFamily)) {
      fontMap.set(cleanFamily, {
        family: cleanFamily,
        variants: weight,
        letterSpacings: letterSpacing,
        fontWeight: weight,
        url: ''
      });
    }
  }

  // Extract fonts from inline styles
  $('*').each((_, element) => {
    const styles = $(element).attr('style');
    if (styles) {
      const fontFamilyMatch = styles.match(/font-family:\s*([^;]+)/i);
      const fontWeightMatch = styles.match(/font-weight:\s*([^;]+)/i);
      const letterSpacingMatch = styles.match(/letter-spacing:\s*([^;]+)/i);

      if (fontFamilyMatch) {
        addFont(
          fontFamilyMatch[1],
          fontWeightMatch ? fontWeightMatch[1].trim() : '400',
          letterSpacingMatch ? letterSpacingMatch[1].trim() : 'normal'
        );
      }
    }
  });

  // Extract fonts from <style> tags
  $('style').each((_, style) => {
    const cssText = $(style).html();
    if (!cssText) return;
    const fontFaceMatches = cssText.match(/@font-face\s*{[^}]+}/g);
    if (fontFaceMatches) {
      fontFaceMatches.forEach(fontFace => {
        const familyMatch = fontFace.match(/font-family:\s*(['"])(.+?)\1/);
        const weightMatch = fontFace.match(/font-weight:\s*(\d+)/);
        if (familyMatch) {
          addFont(familyMatch[2], weightMatch ? weightMatch[1] : '400');
        }
      });
    }
  });

  // Extract Google Fonts URL
  const googleFontsUrl = $('link[href^="https://fonts.googleapis.com/css"]').attr('href') || '';

  return Array.from(fontMap.values()).map(font => ({
    family: font.family,
    variants: Array.from(font.variants).join(','),
    letterSpacings: Array.from(font.letterSpacings).join(','),
    fontWeight: font.fontWeight,
    url: googleFontsUrl || `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family.replace(/\s+/g, '+'))}&display=swap`
  }));
}

function extractPrimaryButton($: cheerio.CheerioAPI): PrimaryButton {
  const button = $('button').first();
  const styles = button.attr('style') || '';

  function extractStyle(property: string): string {
    const match = styles.match(new RegExp(`${property}:\\s*([^;]+)`, 'i'));
    return match ? match[1].trim() : '';
  }

  return {
    fontFamily: cleanFontFamily(extractStyle('font-family')),
    fontSize: extractStyle('font-size') || '16px',
    lineHeight: extractStyle('line-height') || '1.5',
    letterSpacing: extractStyle('letter-spacing') || '0.01em',
    textTransform: extractStyle('text-transform') || 'uppercase',
    textDecoration: extractStyle('text-decoration') || 'underline',
    textAlign: extractStyle('text-align') || 'left',
    backgroundColor: extractStyle('background-color') || '#000',
    color: extractStyle('color') || '#fff',
    borderColor: extractStyle('border-color') || '#000',
    borderWidth: extractStyle('border-width') || '1px',
    borderRadius: extractStyle('border-radius') || '4px'
  };
}

async function scrapeUrl(url: string): Promise<ScraperResponse> {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const fonts = extractFonts($);
    const primaryButton = extractPrimaryButton($);

    return {
      fonts,
      primaryButton
    };
  } catch (error) {
    console.error("Error in scrapeUrl:", error);
    throw new Error(`Failed to scrape the URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const url = 'https://growgrows.com/en-us/products/plentiful-planets-sleepsuit';

scrapeUrl(url)
  .then(response => {
    console.log('Scrape Response:');
    console.log('Fonts:', response.fonts);
    console.log('Primary Button:', response.primaryButton);
  })
  .catch(error => {
    console.error("Error:", error);
  });

export { scrapeUrl };
