const form = document.querySelector("form");

form.addEventListener("submit", function () {
    setTimeout(function () {
        form.reset();
    }, 1000);
});