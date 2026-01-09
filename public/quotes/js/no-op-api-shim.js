/*
 * No-Op API Shim for Legacy kanva-quotes
 * 
 * This file intercepts fetch calls to old API endpoints that no longer exist
 * and returns empty responses to prevent console errors.
 * 
 * The old kanva-quotes app is being replaced with a native React implementation,
 * but we keep this for backward compatibility during the transition.
 */

(function() {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // List of deprecated endpoints
    const deprecatedEndpoints = [
        '/api/env-config',
        '/api/connections',
        '/api/connections/github',
        '/api/connections/copper',
        '/api/connections/shipstation',
        '/api/connections/fishbowl',
        '/api/connections/ringcentral'
    ];
    
    // Override fetch
    window.fetch = function(url, options) {
        // Check if this is a deprecated endpoint
        const urlString = typeof url === 'string' ? url : url.toString();
        
        if (deprecatedEndpoints.some(endpoint => urlString.includes(endpoint))) {
            console.log(`ℹ️ Intercepted deprecated API call: ${urlString} - returning empty response`);
            
            // Return a mock successful response
            return Promise.resolve(new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'API endpoint deprecated - data now managed in Firestore',
                    data: {} 
                }),
                {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                }
            ));
        }
        
        // Call original fetch for all other requests
        return originalFetch.apply(this, arguments);
    };
    
    console.log('✅ API shim loaded - deprecated endpoints will return empty responses');
})();
