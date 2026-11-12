```javascript
const CACHE_NAME = "edutech-hms-v3";

const APP_SHELL = [
    "./",
    "./login.html",
    "./index.html",
    "./manifest.json",
    "./style.css",
    "./supabase.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", function (event) {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(APP_SHELL);
            })
            .then(function () {
                return self.skipWaiting();
            })
    );

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", function (event) {

    event.waitUntil(

        caches.keys()
            .then(function (keys) {

                return Promise.all(

                    keys
                        .filter(function (key) {
                            return key !== CACHE_NAME;
                        })
                        .map(function (key) {
                            return caches.delete(key);
                        })

                );

            })
            .then(function () {
                return self.clients.claim();
            })

    );

});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", function (event) {

    /*
       Only handle GET requests.
    */

    if (event.request.method !== "GET") {
        return;
    }


    /*
       Only handle files from the EDU TECH website.

       This is very important because the hotel system
       uses Supabase and external services.

       External requests must NOT be intercepted
       by this service worker.
    */

    const requestURL = new URL(event.request.url);

    if (requestURL.origin !== self.location.origin) {
        return;
    }


    /*
       Network first.

       This ensures the hotel system always tries to
       load the newest version from GitHub Pages.

       If the internet is unavailable, the cached version
       can still be used.
    */

    event.respondWith(

        fetch(event.request)

            .then(function (response) {

                if (response && response.ok) {

                    const responseClone = response.clone();

                    caches.open(CACHE_NAME)
                        .then(function (cache) {

                            cache.put(
                                event.request,
                                responseClone
                            );

                        });

                }

                return response;

            })

            .catch(function () {

                return caches.match(event.request)

                    .then(function (cachedResponse) {

                        if (cachedResponse) {
                            return cachedResponse;
                        }


                        /*
                           If the requested page isn't cached,
                           return the login page.
                        */

                        return caches.match("./login.html");

                    });

            })

    );

});
```