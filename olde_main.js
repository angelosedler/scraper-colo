const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Add your URLs here
const urls = 
        [
            "https://www.360apartmentrenovations.com/apartment-renovations",
            "https://www.360apartmentrenovations.com/commercial-home-renovations",
            "https://www.360apartmentrenovations.com/apartment-capital-improvement-projects",

          ]

    
      

// Enhanced function to extract text from a single page
async function extractTextFromPage(browser, url, index) {
    const page = await browser.newPage();
    
    try {
        console.log(`[${index + 1}] Starting: ${url}`);
        
        // Set user agent to avoid being blocked
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport to ensure consistent rendering
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Navigate to the page with extended timeout
        await page.goto(url, { 
            waitUntil: ['networkidle0', 'domcontentloaded'], 
            timeout: 45000 
        });
        
        // Wait for the page to fully load and render
        // await page.waitForTimeout(3000);
        
        // Scroll through the page to trigger lazy loading
        await page.evaluate(async () => {
            const scrollStep = 500;
            const scrollDelay = 200;
            
            for (let i = 0; i < document.body.scrollHeight; i += scrollStep) {
                window.scrollTo(0, i);
                await new Promise(resolve => setTimeout(resolve, scrollDelay));
            }
            
            // Scroll back to top
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 500));
        });
        
        // Wait for any dynamic content to load after scrolling
        // await page.waitForTimeout(2000);
        
        // Enhanced text extraction with multiple strategies
        const textContent = await page.evaluate(() => {
            // Strategy 1: Remove scripts, styles, and other non-content elements
            const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe, svg, canvas');
            elementsToRemove.forEach(el => el.remove());
            
            // Strategy 2: Force visibility of potentially hidden elements
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                    // Temporarily make visible to extract text
                    el.style.display = 'block';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                }
            });
            
            // Strategy 3: Extract text using multiple methods and combine
            const methods = [
                // Method 1: Standard innerText
                () => document.body.innerText || '',
                
                // Method 2: textContent for hidden elements
                () => document.body.textContent || '',
                
                // Method 3: Extract from specific content elements
                () => {
                    const contentSelectors = [
                        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                        'li', 'td', 'th', 'span', 'div[class*="text"]',
                        'div[class*="content"]', 'div[data-testid*="text"]',
                        'div[data-testid="richTextElement"]', '[class*="rich-text"]'
                    ];
                    
                    const texts = [];
                    contentSelectors.forEach(selector => {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            const text = el.innerText || el.textContent;
                            if (text && text.trim().length > 0) {
                                texts.push(text.trim());
                            }
                        });
                    });
                    
                    return texts.join('\n');
                },
                
                // Method 4: Extract alt text from images
                () => {
                    const images = document.querySelectorAll('img[alt]');
                    const altTexts = Array.from(images)
                        .map(img => img.alt)
                        .filter(alt => alt && alt.trim().length > 0);
                    return altTexts.length > 0 ? '\n[IMAGE ALT TEXTS]\n' + altTexts.join('\n') : '';
                }
            ];
            
            // Combine all extraction methods
            const allTexts = methods.map(method => {
                try {
                    return method();
                } catch (e) {
                    return '';
                }
            }).filter(text => text && text.trim().length > 0);
            
            // Remove duplicates and clean up
            const combinedText = allTexts.join('\n\n');
            
            // Clean up the text
            return combinedText
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
                .trim();
        });
        
        console.log(`[${index + 1}] ✅ Completed: ${url} (${textContent.length} characters)`);
        
        return {
            url,
            content: textContent,
            timestamp: new Date().toLocaleString(),
            index,
            length: textContent.length
        };
    } catch (error) {
        console.error(`[${index + 1}] ❌ Error extracting text from ${url}:`, error.message);
        return {
            url,
            content: `Error extracting content from ${url}: ${error.message}`,
            timestamp: new Date().toLocaleString(),
            index,
            length: 0
        };
    } finally {
        await page.close();
    }
}

// Main function to process all URLs in parallel
async function processUrls() {
    if (urls.length === 0) {
        console.log('No URLs provided. Please add URLs to the urls array.');
        return;
    }
    
    console.log(`🚀 Starting to process ${urls.length} URLs in parallel...`);
    console.log('🔍 Using enhanced text extraction with lazy-loading support');
    console.log('You will see multiple browser tabs opening simultaneously!\n');
    
    const browser = await puppeteer.launch({
        headless: false, // Run in visible mode so you can see what's happening
        defaultViewport: null, // Use full screen
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--start-maximized',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });
    
    try {
        // Process all URLs in parallel using Promise.all
        const startTime = Date.now();
        
        const results = await Promise.all(
            urls.map((url, index) => extractTextFromPage(browser, url, index))
        );
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`\n🎉 All ${urls.length} URLs processed in ${duration} seconds!`);
        
        // Sort results by original index to maintain order
        results.sort((a, b) => a.index - b.index);
        
        // Show content length statistics
        const totalChars = results.reduce((sum, result) => sum + result.length, 0);
        console.log(`📊 Total content extracted: ${totalChars.toLocaleString()} characters`);
        
        // Combine all content
        let allContent = '';
        
        results.forEach((result) => {
            allContent += `\n${'='.repeat(80)}\n`;
            allContent += `URL: ${result.url}\n`;
            allContent += `Processed on: ${result.timestamp}\n`;
            allContent += `Content length: ${result.length.toLocaleString()} characters\n`;
            allContent += `${'='.repeat(80)}\n\n`;
            allContent += result.content;
            allContent += '\n\n';
        });
        
        // Save all content to a single file
        const filename = 'all_extracted_content.txt';
        const filepath = path.join(__dirname, filename);
        
        const finalContent = `EXTRACTED CONTENT FROM ${urls.length} URLs (ENHANCED EXTRACTION)\n`;
        const timestamp = `Generated on: ${new Date().toLocaleString()}\n`;
        const processingInfo = `Processing time: ${duration} seconds\n`;
        const statsInfo = `Total content: ${totalChars.toLocaleString()} characters\n`;
        const separator = `${'='.repeat(80)}\n\n`;
        
        await fs.writeFile(filepath, finalContent + timestamp + processingInfo + statsInfo + separator + allContent, 'utf8');
        console.log(`\n✅ All content saved to: ${filename}`);
        console.log(`📄 Total URLs processed: ${urls.length}`);
        console.log(`⚡ Processing time: ${duration} seconds`);
        console.log(`📊 Average content per page: ${Math.round(totalChars / urls.length).toLocaleString()} characters`);
        
    } catch (error) {
        console.error('Error during processing:', error);
    } finally {
        console.log('\n⏳ Keeping browser open for 10 seconds so you can see all the tabs...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
        console.log('🔒 Browser closed. All URLs processed!');
    }
}

// Run the script
processUrls().catch(console.error);
