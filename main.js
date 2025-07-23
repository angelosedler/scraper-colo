const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Add your single URL here
const targetUrl = "https://www.360apartmentrenovations.com/blog";

// Function to extract all anchor links from a page
async function extractLinksFromPage(page, url) {
    try {
        console.log(`🔍 Visiting: ${url}`);
        
        // Navigate to the page with extended timeout
        await page.goto(url, { 
            waitUntil: ['networkidle0', 'domcontentloaded'], 
            timeout: 45000 
        });
        
        // Wait for the page to fully load and render
        await page.waitForTimeout(3000);
        
        // Enhanced scrolling automation for lazy loading content
        console.log(`📜 Starting enhanced scrolling to trigger lazy loading...`);
        
        await page.evaluate(async () => {
            let totalHeight = document.body.scrollHeight;
            
            console.log(`Total page height: ${totalHeight}px`);
            
            // First pass: Slow scroll down
            for (let i = 0; i < totalHeight; i += 300) {
                window.scrollTo(0, i);
                console.log(`Scrolling to: ${i}px`);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if new content was loaded (page height increased)
                const newHeight = document.body.scrollHeight;
                if (newHeight > totalHeight) {
                    console.log(`New content detected! Height increased from ${totalHeight}px to ${newHeight}px`);
                    totalHeight = newHeight;
                }
            }
            
            // Scroll to the very bottom and wait
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Second pass: Scroll back up slowly to trigger any upward lazy loading
            const finalHeight = document.body.scrollHeight;
            for (let i = finalHeight; i >= 0; i -= 300) {
                window.scrollTo(0, i);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Final scroll to bottom again
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Return to top
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 1000));
        });
        
        console.log(`✅ Scrolling completed, waiting for final content to load...`);
        
        // Wait for any final dynamic content to load after scrolling
        await page.waitForTimeout(3000);
        
        // Extract all anchor links
        const links = await page.evaluate(() => {
            // Get all anchor elements
            const anchors = document.querySelectorAll('a[href]');
            const linkData = [];
            
            anchors.forEach((anchor, index) => {
                const href = anchor.href;
                const text = anchor.innerText || anchor.textContent || '';
                const title = anchor.title || '';
                
                // Only include valid links
                if (href && href.trim() !== '' && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
                    linkData.push({
                        index: index + 1,
                        url: href.trim(),
                        text: text.trim(),
                        title: title.trim()
                    });
                }
            });
            
            // Remove duplicates based on URL
            const uniqueLinks = [];
            const seenUrls = new Set();
            
            linkData.forEach(link => {
                if (!seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    uniqueLinks.push(link);
                }
            });
            
            return uniqueLinks;
        });
        
        console.log(`✅ Found ${links.length} unique links`);
        
        return {
            url,
            links,
            timestamp: new Date().toLocaleString(),
            totalLinks: links.length
        };
        
    } catch (error) {
        console.error(`❌ Error extracting links from ${url}:`, error.message);
        return {
            url,
            links: [],
            timestamp: new Date().toLocaleString(),
            totalLinks: 0,
            error: error.message
        };
    }
}

// Main function to extract links
async function extractLinks() {
    if (!targetUrl || targetUrl.trim() === '') {
        console.log('❌ No URL provided. Please set the targetUrl variable.');
        return;
    }
    
    console.log(`🚀 Starting to extract links from: ${targetUrl}`);
    console.log('🔍 Chrome will open and navigate to the page...\n');
    
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
        const page = await browser.newPage();
        
        // Set user agent to avoid being blocked
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport to ensure consistent rendering
        await page.setViewport({ width: 1920, height: 1080 });
        
        const startTime = Date.now();
        
        // Extract links from the page
        const result = await extractLinksFromPage(page, targetUrl);
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`\n🎉 Link extraction completed in ${duration} seconds!`);
        console.log(`📊 Total unique links found: ${result.totalLinks}`);
        
        // Prepare content for the file
        let fileContent = `EXTRACTED LINKS FROM: ${targetUrl}\n`;
        fileContent += `Generated on: ${result.timestamp}\n`;
        fileContent += `Processing time: ${duration} seconds\n`;
        fileContent += `Total unique links: ${result.totalLinks}\n`;
        fileContent += `${'='.repeat(80)}\n\n`;
        
        if (result.error) {
            fileContent += `ERROR: ${result.error}\n\n`;
        }
        
        if (result.links && result.links.length > 0) {
            // Group links by domain for better organization
            const linksByDomain = {};
            
            result.links.forEach(link => {
                try {
                    const domain = new URL(link.url).hostname;
                    if (!linksByDomain[domain]) {
                        linksByDomain[domain] = [];
                    }
                    linksByDomain[domain].push(link);
                } catch (e) {
                    // If URL parsing fails, put in "other" category
                    if (!linksByDomain['other']) {
                        linksByDomain['other'] = [];
                    }
                    linksByDomain['other'].push(link);
                }
            });
            
            // Write organized content
            Object.keys(linksByDomain).sort().forEach(domain => {
                fileContent += `\n--- LINKS FROM: ${domain} (${linksByDomain[domain].length} links) ---\n\n`;
                
                linksByDomain[domain].forEach((link, index) => {
                    fileContent += `${index + 1}. ${link.url}\n`;
                    if (link.text) {
                        fileContent += `   Text: ${link.text}\n`;
                    }
                    if (link.title) {
                        fileContent += `   Title: ${link.title}\n`;
                    }
                    fileContent += '\n';
                });
            });
            
            // Also add a simple list of all URLs at the end
            fileContent += `\n${'='.repeat(80)}\n`;
            fileContent += `SIMPLE URL LIST (for easy copying):\n`;
            fileContent += `${'='.repeat(80)}\n\n`;
            
            result.links.forEach((link, index) => {
                fileContent += `${link.url}\n`;
            });
        } else {
            fileContent += 'No links found on this page.\n';
        }
        
        // Save links to file
        const filename = 'extracted_links.txt';
        const filepath = path.join(__dirname, filename);
        
        await fs.writeFile(filepath, fileContent, 'utf8');
        console.log(`\n✅ All links saved to: ${filename}`);
        console.log(`📁 File location: ${filepath}`);
        
    } catch (error) {
        console.error('❌ Error during processing:', error);
    } finally {
        console.log('\n⏳ Keeping browser open for 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
        console.log('🔒 Browser closed. Link extraction completed!');
    }
}

// Run the script
extractLinks().catch(console.error);
