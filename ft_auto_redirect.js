// FT Auto Redirect to Google Search
// Automatically searches Google for institutional access when clicking FT links

(function() {
    'use strict';
    
    console.log('BPC: FT Auto Redirect to Google Search loaded');
    
    // Configuration for institutional access domains
    const INSTITUTIONAL_DOMAINS = [
        'www-ft-com.ezphost.dur.ac.uk',  // Durham University
        'ft-com.ezp-prod1.hul.harvard.edu',  // Harvard
        'ft-com.proxy.lib.umich.edu',  // University of Michigan
        'www-ft-com.ezproxy',  // Generic ezproxy
    ];
    
    // Check if we're already on an institutional domain
    function isOnInstitutionalDomain() {
        return INSTITUTIONAL_DOMAINS.some(domain => 
            window.location.hostname === domain || window.location.hostname.includes(domain)
        );
    }
    
    // Check if we're on a Google search page
    function isOnGoogleSearch() {
        return window.location.hostname.includes('google.com') && 
               window.location.pathname.includes('/search');
    }
    
    // Extract article ID from FT URL for better search
    function extractArticleId(url) {
        const match = url.match(/\/content\/([a-f0-9-]+)/);
        return match ? match[1] : null;
    }
    
    // Create Google search URL for FT article
    function createGoogleSearchUrl(ftUrl) {
        // Use the full URL as search query - Google will find institutional access
        const searchQuery = encodeURIComponent(ftUrl);
        return `https://www.google.com/search?q=${searchQuery}`;
    }
    
    // Handle FT link redirect to Google search
    function handleFTRedirect(originalUrl) {
        console.log('BPC: Redirecting FT URL to Google search:', originalUrl);
        
        const googleSearchUrl = createGoogleSearchUrl(originalUrl);
        console.log('BPC: Opening Google search:', googleSearchUrl);
        
        // Navigate to Google search
        window.location.href = googleSearchUrl;
    }
    
    // Intercept FT link clicks
    function interceptFTLinks() {
        console.log('BPC: Setting up FT link interceptor on:', window.location.hostname);
        
        document.addEventListener('click', function(event) {
            console.log('BPC: Click detected on:', event.target);
            
            const link = event.target.closest('a[href]');
            if (!link) {
                console.log('BPC: No link found for click target');
                return;
            }
            
            const href = link.href;
            console.log('BPC: Link clicked:', href);
            
            // Check if it's an FT link that needs redirection
            const isFTLink = href.includes('/content/') && (
                href.includes('ft.com') || 
                INSTITUTIONAL_DOMAINS.some(domain => href.includes(domain))
            );
            const isRegularFTDomain = href.includes('://www.ft.com') || href.includes('://ft.com');
            const isTargetInstitutional = INSTITUTIONAL_DOMAINS.some(domain => href.includes(domain));
            const isOnInstitutional = isOnInstitutionalDomain();
            const isOnGoogle = isOnGoogleSearch();
            
            console.log('BPC: Link analysis:');
            console.log('  - isFTLink:', isFTLink);
            console.log('  - isOnGoogle:', isOnGoogle);
            console.log('  - isOnInstitutional:', isOnInstitutional);
            console.log('  - isRegularFTDomain:', isRegularFTDomain);
            console.log('  - isTargetInstitutional:', isTargetInstitutional);
            
            // Redirect to Google search if:
            // 1. It's an FT content link AND
            // 2. We're not already on a Google search page
            // Always redirect FT content links to Google to find working institutional access
            const shouldRedirect = isFTLink && !isOnGoogle;
            
            console.log('BPC: Should redirect:', shouldRedirect);
            
            if (shouldRedirect) {
                console.log('BPC: Intercepting FT link click:', href);
                console.log('BPC: Current hostname:', window.location.hostname);
                
                // Prevent default navigation
                event.preventDefault();
                event.stopPropagation();
                
                // Redirect to Google search
                handleFTRedirect(href);
            }
        }, true); // Use capture phase to intercept early
    }
    
    // Highlight institutional links on Google search results and auto-click
    function highlightInstitutionalLinks() {
        if (!isOnGoogleSearch()) {
            console.log('BPC: Not on Google search page');
            return;
        }
        
        console.log('BPC: Searching for institutional links on Google...');
        
        // Find ONLY actual search result links that START with institutional domains
        const resultArea = document.querySelector('#search, #rso, #center_col') || document;
        const durhamLinks = resultArea.querySelectorAll('a[href^="https://www-ft-com.ezphost.dur.ac.uk/content/"], a[href^="https://ft-com.ezphost.dur.ac.uk/content/"]');
        const harvardLinks = resultArea.querySelectorAll('a[href^="https://www-ft-com.ezp-prod1.hul.harvard.edu/content/"], a[href^="https://ft-com.ezp-prod1.hul.harvard.edu/content/"]');
        const michiganLinks = resultArea.querySelectorAll('a[href^="https://www-ft-com.proxy.lib.umich.edu/content/"], a[href^="https://ft-com.proxy.lib.umich.edu/content/"]');
        const otherProxyLinks = resultArea.querySelectorAll('a[href^="https://"][href*="ezproxy"][href*="/content/"]');
        
        console.log('BPC: Found links:');
        console.log('  - Durham links:', durhamLinks.length, Array.from(durhamLinks).map(l => l.href));
        console.log('  - Harvard links:', harvardLinks.length, Array.from(harvardLinks).map(l => l.href));
        console.log('  - Michigan links:', michiganLinks.length, Array.from(michiganLinks).map(l => l.href));
        console.log('  - Other proxy links:', otherProxyLinks.length, Array.from(otherProxyLinks).map(l => l.href));
        
        // Combine all institutional links with Durham first (highest priority)
        const allInstitutionalLinks = [
            ...Array.from(durhamLinks),
            ...Array.from(harvardLinks), 
            ...Array.from(michiganLinks),
            ...Array.from(otherProxyLinks)
        ];
        
        // Remove duplicates
        const uniqueLinks = [...new Set(allInstitutionalLinks)];
        
        console.log('BPC: Total unique institutional links found:', uniqueLinks.length);
        
        if (uniqueLinks.length === 0) {
            console.log('BPC: No institutional content links found - no auto-clicking will occur');
            console.log('BPC: This usually means Google did not find any results for this article');
            
            // Show a notification that no institutional access was found
            showNoAccessNotification();
            return;
        }
        
        // Highlight all institutional links
        uniqueLinks.forEach((link, index) => {
            // Add visual highlighting
            link.style.cssText += `
                background: linear-gradient(45deg, #fff1c4, #f0f9ff) !important;
                border: 2px solid #10b981 !important;
                border-radius: 4px !important;
                padding: 4px 8px !important;
                margin: 2px 0 !important;
                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2) !important;
            `;
            
            // Add a badge
            if (!link.querySelector('.bpc-institutional-badge')) {
                const badge = document.createElement('span');
                badge.className = 'bpc-institutional-badge';
                badge.innerHTML = index === 0 ? '🎓 Auto-Clicking...' : '🎓 Institutional Access';
                badge.style.cssText = `
                    background: ${index === 0 ? '#ef4444' : '#10b981'} !important;
                    color: white !important;
                    font-size: 11px !important;
                    padding: 2px 6px !important;
                    border-radius: 12px !important;
                    margin-left: 8px !important;
                    font-weight: bold !important;
                `;
                link.appendChild(badge);
            }
        });
        
        // Show notification about auto-clicking
        showAutoClickNotification(uniqueLinks.length, uniqueLinks[0]);
        
        // Auto-click the first (highest priority) institutional link immediately
        const linkToClick = uniqueLinks[0];
        console.log('BPC: About to auto-click link:', linkToClick.href);
        console.log('BPC: Link element:', linkToClick);
        console.log('BPC: Link text:', linkToClick.textContent.trim());
        
        // Add a small delay to ensure the page is fully loaded
        setTimeout(() => {
            console.log('BPC: Auto-clicking now!');
            linkToClick.click();
        }, 500);
    }
    
    // Show notification when no institutional access is found
    function showNoAccessNotification() {
        const notification = document.createElement('div');
        notification.id = 'bpc-no-access-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: #ef4444;
                color: white;
                border-radius: 6px;
                padding: 12px 16px;
                max-width: 320px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                font-family: system-ui, -apple-system, sans-serif;
            ">
                <div style="font-weight: bold; margin-bottom: 4px;">❌ No Institutional Access Found</div>
                <div style="opacity: 0.9; font-size: 12px;">Google could not find any institutional access links for this article.</div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    position: absolute;
                    top: 4px;
                    right: 6px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    opacity: 0.7;
                ">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Show notification for auto-clicking
    function showAutoClickNotification(count, linkToClick) {
        // Don't show if already exists
        if (document.getElementById('bpc-institutional-notification')) return;
        
        const linkText = linkToClick.href.includes('ezphost.dur.ac.uk') ? 'Durham' :
                        linkToClick.href.includes('ezp-prod1.hul.harvard.edu') ? 'Harvard' :
                        linkToClick.href.includes('proxy.lib.umich.edu') ? 'Michigan' : 'Institutional';
        
        const notification = document.createElement('div');
        notification.id = 'bpc-institutional-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: #10b981;
                color: white;
                border-radius: 6px;
                padding: 12px 16px;
                max-width: 320px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                font-family: system-ui, -apple-system, sans-serif;
            ">
                <div style="font-weight: bold; margin-bottom: 4px;">🎓 Found ${count} Institutional Link${count > 1 ? 's' : ''}!</div>
                <div style="opacity: 0.9; font-size: 12px;">Auto-clicking ${linkText} access now...</div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    position: absolute;
                    top: 4px;
                    right: 6px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    opacity: 0.7;
                ">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-hide after clicking
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
    
    // Show notification to user about the auto-redirect feature
    function showRedirectNotification() {
        if (isOnInstitutionalDomain() || isOnGoogleSearch()) return;
        
        const notification = document.createElement('div');
        notification.id = 'bpc-ft-redirect-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: #fff1c4;
                border: 1px solid #d4b106;
                border-radius: 4px;
                padding: 12px;
                max-width: 300px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, sans-serif;
            ">
                <div style="font-weight: bold; margin-bottom: 8px;">🔍 BPC: FT Google Search Active</div>
                <div style="color: #666;">Clicking FT links will search Google for institutional access</div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    background: none;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                ">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    // Initialize when DOM is ready
    function initialize() {
        console.log('BPC: Initializing FT Google Search Redirect');
        
        // Run on FT pages (both regular and institutional)
        if (window.location.hostname.includes('ft.com') || isOnInstitutionalDomain()) {
            interceptFTLinks();
            
            // Show notification only on regular FT pages (not institutional)
            if (window.location.hostname.includes('ft.com') && !isOnInstitutionalDomain()) {
                showRedirectNotification();
            }
        }
        
        // Run on Google search pages
        if (isOnGoogleSearch()) {
            // Highlight institutional links after page loads
            setTimeout(highlightInstitutionalLinks, 1000);
            
            // Also watch for dynamic content updates (Google loads results dynamically)
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes.length > 0) {
                        highlightInstitutionalLinks();
                    }
                });
            });
            
            // Observe the search results container
            const resultsContainer = document.querySelector('#search, #rso, #center_col');
            if (resultsContainer) {
                observer.observe(resultsContainer, {
                    childList: true,
                    subtree: true
                });
            }
        }
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Handle dynamic content on FT pages (both regular and institutional)
    if (window.location.hostname.includes('ft.com') || isOnInstitutionalDomain()) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    // Re-setup interceptors for dynamically added links
                    interceptFTLinks();
                }
            });
        });
        
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
})(); 