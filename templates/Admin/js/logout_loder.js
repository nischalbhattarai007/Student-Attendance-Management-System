function redirectToDashboard(event) {
    event.preventDefault();
  
    const overlay = document.getElementById("loaderOverlay");
    const loader = document.getElementById("loader");
    const successMessage = document.getElementById("successMessage");
  
    overlay.style.display = "flex";
  
    setTimeout(() => {
      loader.style.display = "none";
      successMessage.style.display = "block";
    }, 1500); // Show loader for 1.5 sec
  
    setTimeout(() => {
      window.location.href = "../login/signIn.html";
    }, 2500); // Redirect after 5 seconds total
  }
  