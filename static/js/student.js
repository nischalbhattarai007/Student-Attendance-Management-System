// Student Dashboard JavaScript Functions

// Show/Hide Sections
function showStudentSection(sectionId, navLink) {
  document.querySelectorAll('section[id$="-content"]').forEach(section => {
    section.classList.add('hidden');
    section.classList.remove('active-section'); 
  });
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });

  const currentSection = document.getElementById(sectionId + '-content');
  let sectionTitle = 'Student Dashboard'; // Default title
  if (currentSection) {
    currentSection.classList.remove('hidden');
    currentSection.classList.add('active-section');
    if (navLink && navLink.querySelector('span')) {
      sectionTitle = navLink.querySelector('span').textContent;
    } else {
      sectionTitle = sectionId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    document.getElementById('student-main-title').textContent = sectionTitle;
  }
  if (navLink) {
    navLink.classList.add('active');
  }

  const basePath = "/Student/dashboard";
  const newUrl = sectionId === 'student-dashboard' ? basePath : `${basePath}/${sectionId}`;
  if (window.location.pathname !== newUrl) {
    history.pushState({section: sectionId}, sectionTitle, newUrl);
  }

  // Load data for specific sections
  if (sectionId === 'student-dashboard') {
    // These might be loaded by DOMContentLoaded initially
  } else if (sectionId === 'student-class-routine') {
    loadStudentClassRoutine();
  } else if (sectionId === 'my-attendance') {
    fetchAttendanceHistory(); // Ensure this function exists and is called correctly
  }
  // Add more specific loaders if needed
}

async function loadStudentProfileData() {
    try {
        const response = await fetch('/Student/profile-data');
        const result = await response.json();
        if (result.success && result.data) {
            const student = result.data;
            document.getElementById('welcome-student-name').textContent = student.Stu_name || 'Student';
            document.getElementById('student-dynamic-name').textContent = student.Stu_name || 'Student';
            
            // Populate profile page if these elements exist
            const profileLargeImage = document.getElementById('profile-large-image');
            if (profileLargeImage) profileLargeImage.src = student.photo_url || 'https://placehold.co/120x120/A0AEC0/FFFFFF?text=S';
            
            const profileHeaderName = document.getElementById('profile-header-name');
            if (profileHeaderName) profileHeaderName.textContent = student.Stu_name || 'N/A';
            
            const profileHeaderEmail = document.getElementById('profile-header-email');
            if (profileHeaderEmail) profileHeaderEmail.textContent = student.Stu_email || 'N/A';
            
            const profileHeaderId = document.getElementById('profile-header-id');
            if (profileHeaderId) profileHeaderId.textContent = `Student ID: ${student.stu_id || 'N/A'}`;

            const profileHeaderSemester = document.getElementById('profile-header-semester');
            if (profileHeaderSemester) profileHeaderSemester.textContent = `Current Semester: ${student.semester || 'N/A'}`;

            const profileNameInput = document.getElementById('profile-name');
            if (profileNameInput) profileNameInput.value = student.Stu_name || '';
            
            const profileEmailInput = document.getElementById('profile-email');
            if (profileEmailInput) profileEmailInput.value = student.Stu_email || '';

            const profilePhoneInput = document.getElementById('profile-phone');
            if (profilePhoneInput) profilePhoneInput.value = student.Stu_contact || '';

            const profileSemesterDisplay = document.getElementById('profile-semester-display');
            if (profileSemesterDisplay) profileSemesterDisplay.value = student.semester || '';

            const profileAddressTextarea = document.getElementById('profile-address');
            if (profileAddressTextarea) profileAddressTextarea.value = student.Stu_Address || '';

        } else {
            document.getElementById('welcome-student-name').textContent = 'Student';
             document.getElementById('student-dynamic-name').textContent = 'Student';
        }
    } catch (error) {
        document.getElementById('welcome-student-name').textContent = 'Student';
        document.getElementById('student-dynamic-name').textContent = 'Student';
    }
}

function toggleStudentDropdown(dropdownId) {
  document.getElementById(dropdownId)?.classList.toggle('show');
}

async function updateStudentClock() {
  const clockElement = document.getElementById('student-clock');
  if (clockElement) {
    try {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      
      // Get current day of week (0=Sunday, 1=Monday, etc.)
      const dayOfWeek = now.getDay();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[dayOfWeek];
      
      // Fetch current class information
      const response = await fetch('/Student/api/class-routine/current');
      const result = await response.json();
      
      let classInfo = 'No current class';
      if (result.success && result.data) {
        const currentClass = result.data;
        if (currentClass) {
          classInfo = `${currentClass.class_name} (${currentClass.time})`;
        }
      }
      
      clockElement.innerHTML = `
        <div class="flex flex-col">
          <div class="text-lg font-medium">${timeString}</div>
          <div class="text-xs">${dateString}</div>
          <div class="text-xs mt-1">${classInfo}</div>
        </div>
      `;
    } catch (error) {
      console.error('Error updating clock:', error);
      clockElement.innerHTML = `
        <div class="text-lg font-medium">${timeString}</div>
        <div class="text-xs">${dateString}</div>
        <div class="text-xs mt-1">Error fetching class info</div>
      `;
    }
  }
}

// Function to load student's class routine
async function loadStudentClassRoutine() {
    const routineCardTitle = document.getElementById('student-routine-card-title'); 
    const tableContainer = document.getElementById('student-class-routine-table-container');
    const noRoutineMessage = document.getElementById('no-student-routine-message');

    if (!routineCardTitle || !tableContainer || !noRoutineMessage) {
        if(noRoutineMessage) {
            noRoutineMessage.textContent = 'Error: UI components for routine display are missing.';
            noRoutineMessage.classList.remove('hidden');
        }
        return;
    }

    // 1. Set initial title HTML and then get the span.
    routineCardTitle.innerHTML = '<i class="fas fa-calendar-alt text-purple-600 mr-3"></i>My Class Routine (Semester <span id="student-routine-semester-display">?</span>)';
    const semesterDisplay = document.getElementById('student-routine-semester-display'); // Get span after it's created

    if (!semesterDisplay) {
        routineCardTitle.innerHTML = '<i class="fas fa-calendar-alt text-purple-600 mr-3"></i>My Class Routine'; 
        return;
    }

    tableContainer.innerHTML = '<p class="text-center text-gray-500 py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading routine...</p>';
    noRoutineMessage.classList.add('hidden');

    try {
        const response = await fetch('/Student/api/class-routine');
        const data = await response.json();

        if (data && typeof data.semester !== 'undefined') {
            if (data.semester) { 
                semesterDisplay.textContent = data.semester;
            } else { 
                semesterDisplay.textContent = 'Not Set';
            }
        } else {
            semesterDisplay.textContent = '?'; 
        }

        if (data.success) {
            if (data.routines && data.routines.length > 0) {
                let tableHTML = '<table class="min-w-full divide-y divide-gray-200">';
                tableHTML += '<thead class="bg-gray-50"><tr>' +
                             '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course ID</th>' +
                             '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>' +
                             '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>' +
                             '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>' +
                             '</tr></thead><tbody class="bg-white divide-y divide-gray-200">';
                data.routines.forEach(routine => {
                    tableHTML += '<tr>' +
                                 `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${routine.course_id || 'N/A'}</td>` +
                                 `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${routine.subject_name || 'N/A'}</td>` +
                                 `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${routine.day_of_week || 'N/A'}</td>` +
                                 `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${routine.course_time_formatted || 'N/A'}</td>` +
                                 '</tr>';
                });
                tableHTML += '</tbody></table>';
                tableContainer.innerHTML = tableHTML;
                noRoutineMessage.classList.add('hidden');
            } else {
                tableContainer.innerHTML = ''; // Clear loading message
                if (data.semester) {
                    noRoutineMessage.textContent = `No class routine found for Semester ${data.semester}.`;
                } else {
                    noRoutineMessage.textContent = 'No class routine found. Your semester may not be set.';
                }
                noRoutineMessage.classList.remove('hidden');
            }
        } else {
            tableContainer.innerHTML = ''; // Clear loading message
            semesterDisplay.textContent = (data.semester !== null && data.semester !== undefined) ? data.semester : '?';
            noRoutineMessage.textContent = data.message || 'An error occurred while loading your routine. Please try again.';
            noRoutineMessage.classList.remove('hidden');
        }
    } catch (error) {
        tableContainer.innerHTML = ''; // Clear loading message
        semesterDisplay.textContent = '!'; // Indicate error in semester display
        noRoutineMessage.textContent = 'Failed to load routine. Please check your connection and try again.';
        noRoutineMessage.classList.remove('hidden');
    }
}

// Function to load upcoming classes for the student dashboard
async function loadUpcomingClassesForStudent() {
  const listElement = document.getElementById('student-upcoming-classes-list');
  if (!listElement) return;

  try {
    const response = await fetch('/Student/api/upcoming-classes');
    const data = await response.json();
    listElement.innerHTML = ''; // Clear placeholder

    if (data.success && data.classes && data.classes.length > 0) {
      data.classes.forEach(cls => {
        const listItem = document.createElement('li');
        listItem.className = 'py-1 flex items-center';
        listItem.innerHTML = `
          <i class="fas fa-clock text-blue-500 mr-3"></i> 
          <span class="font-medium text-gray-700">${cls.class_name || 'N/A'}</span> - <span class="text-sm text-gray-500 ml-1">${cls.day_time || 'N/A'}</span>`;
        listElement.appendChild(listItem);
      });
    } else {
      listElement.innerHTML = '<li><i class="fas fa-info-circle text-gray-400 mr-2"></i>No upcoming classes found.</li>';
    }
  } catch (error) {
    listElement.innerHTML = '<li><i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>Error loading classes.</li>';
  }
}

// Function to load recent announcements for the student dashboard
async function loadRecentAnnouncementsForStudent() {
  const listElement = document.getElementById('student-recent-announcements-list');
  if (!listElement) {
    return;
  }

  try {
    const response = await fetch('/Student/api/recent-announcements');
    const data = await response.json();
    listElement.innerHTML = ''; // Clear placeholder or old announcements

    if (data.success && data.announcements && data.announcements.length > 0) {
      data.announcements.forEach(ann => {
        const listItem = document.createElement('li');
        listItem.className = 'py-2 border-b border-gray-200 last:border-b-0';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'font-semibold text-gray-700 flex items-center';
        titleDiv.innerHTML = `<i class="fas fa-bullhorn text-yellow-500 mr-2"></i>${ann.title}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'text-sm text-gray-600 mt-1 pl-6'; // Indent content slightly
        contentDiv.textContent = ann.content;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'text-xs text-gray-400 mt-1 text-right';
        dateDiv.textContent = new Date(ann.date_created).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

        listItem.appendChild(titleDiv);
        listItem.appendChild(contentDiv);
        listItem.appendChild(dateDiv);
        listElement.appendChild(listItem);
      });
    } else {
      listElement.innerHTML = '<li><i class="fas fa-info-circle text-gray-400 mr-2"></i>No recent announcements.</li>';
    }
  } catch (error) {
    listElement.innerHTML = '<li><i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>Error loading announcements.</li>';
  }
}

// Ensure these variables are declared in a scope accessible by relevant functions
// If these are already declared globally or in an accessible scope, adjust as needed.
// The global 'window.stream' is used for the camera feed to avoid scope conflicts.
let videoElement; // Will be initialized in DOMContentLoaded or startWebcam
let captureCanvas;
let boundingBoxCanvas;
let cameraContainer;
let cameraStatusElement;
let videoOverlay;
let identifiedNameElement;
let identifiedIdElement;
let countdownTimerElement;
let identificationInterval;
const IDENTIFICATION_INTERVAL_MS = 2500; // Try to identify every 2.5 seconds

// --- Helper functions for UI updates ---
function showVerificationMessage(message, isSuccess = false, name = '', id = '') {
    // Attempt to re-initialize UI elements if they are null
    if (!videoOverlay) videoOverlay = document.getElementById('video-overlay');
    if (!identifiedNameElement) identifiedNameElement = document.getElementById('identified-name');
    if (!identifiedIdElement) identifiedIdElement = document.getElementById('identified-id');

    if (!videoOverlay || !identifiedNameElement || !identifiedIdElement) {
        return;
    }

    identifiedNameElement.textContent = message;
    if (isSuccess && name) {
        // If a success message from backend is generic like "Verified", enhance it.
        // If backend sends specific "Verified: Name", then use that.
        identifiedNameElement.textContent = (message && message.toLowerCase().startsWith("verified")) ? message : `Verified: ${name}`;
        identifiedIdElement.textContent = `ID: ${id}`;
    } else {
        identifiedIdElement.textContent = '';
    }
    videoOverlay.classList.remove('hidden');
    
    if (isSuccess) {
        identifiedNameElement.className = 'text-2xl font-bold text-green-400 bg-black bg-opacity-60 px-4 py-2 rounded';
    } else {
        identifiedNameElement.className = 'text-2xl font-bold text-red-400 bg-black bg-opacity-60 px-4 py-2 rounded';
    }
}

function hideVerificationMessage() {
    if (!videoOverlay) videoOverlay = document.getElementById('video-overlay');
    if (!identifiedNameElement) identifiedNameElement = document.getElementById('identified-name');
    if (!identifiedIdElement) identifiedIdElement = document.getElementById('identified-id');
    
    if (!videoOverlay || !identifiedNameElement || !identifiedIdElement) return;
    
    videoOverlay.classList.add('hidden');
    identifiedNameElement.textContent = '';
    identifiedIdElement.textContent = '';
}

function drawBoundingBox(location, color = 'lime') {
    if (!boundingBoxCanvas) boundingBoxCanvas = document.getElementById('bounding-box-canvas');
    if (!videoElement) videoElement = document.getElementById('webcam-feed'); // Ensure videoElement is available

    if (!boundingBoxCanvas || !location) return;
    const ctx = boundingBoxCanvas.getContext('2d');
    
    if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        if (boundingBoxCanvas.width !== videoElement.videoWidth || boundingBoxCanvas.height !== videoElement.videoHeight) {
            boundingBoxCanvas.width = videoElement.videoWidth;
            boundingBoxCanvas.height = videoElement.videoHeight;
        }
    } else {
        if (boundingBoxCanvas.width !== 640 || boundingBoxCanvas.height !== 480) {
             boundingBoxCanvas.width = 640;
             boundingBoxCanvas.height = 480;
        }
    }
    ctx.clearRect(0, 0, boundingBoxCanvas.width, boundingBoxCanvas.height);

    if (location && Array.isArray(location) && location.length === 4) {
        const [top, right, bottom, left] = location;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 5; // Thicker border
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; // Drop shadow for visibility
        ctx.shadowBlur = 8;
        // Rounded corners
        const radius = 18;
        const width = right - left;
        const height = bottom - top;
        ctx.beginPath();
        ctx.moveTo(left + radius, top);
        ctx.lineTo(left + width - radius, top);
        ctx.quadraticCurveTo(left + width, top, left + width, top + radius);
        ctx.lineTo(left + width, top + height - radius);
        ctx.quadraticCurveTo(left + width, top + height, left + width - radius, top + height);
        ctx.lineTo(left + radius, top + height);
        ctx.quadraticCurveTo(left, top + height, left, top + height - radius);
        ctx.lineTo(left, top + radius);
        ctx.quadraticCurveTo(left, top, left + radius, top);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

function clearBoundingBox() {
    if (!boundingBoxCanvas) boundingBoxCanvas = document.getElementById('bounding-box-canvas');
    if (!boundingBoxCanvas) return;
    const ctx = boundingBoxCanvas.getContext('2d');
    ctx.clearRect(0, 0, boundingBoxCanvas.width, boundingBoxCanvas.height);
}

// Draw a fixed green guide square in the center of the video feed
function drawGuideSquare() {
    if (!boundingBoxCanvas) boundingBoxCanvas = document.getElementById('bounding-box-canvas');
    if (!videoElement) videoElement = document.getElementById('webcam-feed');
    if (!boundingBoxCanvas || !videoElement) return;
    const ctx = boundingBoxCanvas.getContext('2d');
    const w = videoElement.videoWidth || 640;
    const h = videoElement.videoHeight || 480;
    boundingBoxCanvas.width = w;
    boundingBoxCanvas.height = h;
    ctx.save();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    const guideSize = Math.floor(Math.min(w, h) * 0.5);
    const left = Math.floor((w - guideSize) / 2);
    const top = Math.floor((h - guideSize) / 2);
    const radius = 18;
    ctx.beginPath();
    ctx.moveTo(left + radius, top);
    ctx.lineTo(left + guideSize - radius, top);
    ctx.quadraticCurveTo(left + guideSize, top, left + guideSize, top + radius);
    ctx.lineTo(left + guideSize, top + guideSize - radius);
    ctx.quadraticCurveTo(left + guideSize, top + guideSize, left + guideSize - radius, top + guideSize);
    ctx.lineTo(left + radius, top + guideSize);
    ctx.quadraticCurveTo(left, top + guideSize, left, top + guideSize - radius);
    ctx.lineTo(left, top + radius);
    ctx.quadraticCurveTo(left, top, left + radius, top);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return {left, top, right: left + guideSize, bottom: top + guideSize};
}

// Helper to check if detected face is mostly inside the guide square
function isFaceInsideGuide(faceLoc, guide) {
    if (!faceLoc || !guide) return false;
    const [top, right, bottom, left] = faceLoc;
    // Allow a little margin
    const margin = 20;
    return (
        left >= guide.left + margin &&
        right <= guide.right - margin &&
        top >= guide.top + margin &&
        bottom <= guide.bottom - margin
    );
}

let identificationInProgress = false;

async function attemptLiveIdentification() {
    const videoElement = document.getElementById('webcam-feed');
    const captureCanvas = document.getElementById('capture-canvas');
    const cameraStatusElement = document.getElementById('camera-status');

    if (identificationInProgress || !window.stream || !videoElement || videoElement.paused || videoElement.ended) {
        return;
    }

    identificationInProgress = true;

    try {
        if (captureCanvas.width !== videoElement.videoWidth || captureCanvas.height !== videoElement.videoHeight) {
            captureCanvas.width = videoElement.videoWidth;
            captureCanvas.height = videoElement.videoHeight;
        }

        const context = captureCanvas.getContext('2d');
        context.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);
        const imageDataURL = captureCanvas.toDataURL('image/jpeg', 0.85);
        const formData = new FormData();
        formData.append('image_data', imageDataURL);

        const response = await fetch('/Student/identify-live-face', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        // If verification was successful and we received a definitive attendance message
        if (result.success && result.attendance_message) {
            // CRITICAL: Stop the identification loop immediately and permanently.
            if (identificationInterval) {
                clearInterval(identificationInterval);
                identificationInterval = null;
            }
            // By setting this to true and NOT resetting it, we prevent any lingering calls from running
            identificationInProgress = true; 

            // Show the final message from the backend.
            const messageType = result.attendance_marked ? 'success' : 'error';
            showVerificationMessage(result.attendance_message, true, messageType);

            // Stop the camera and reset the UI after a delay so the user can read the message.
            setTimeout(() => {
                stopWebcam();
                if (result.attendance_marked) {
                    fetchAttendanceHistory(); // Refresh history only if attendance was newly marked.
                }
            }, 4000);

            return; // Exit the function immediately
        } else {
            // Verification failed or another issue occurred. Update status and continue the loop.
            cameraStatusElement.textContent = result.message || 'Align your face in the green square';
            clearBoundingBox();
            if (result.face_location) {
                drawGuideSquare(); // Draw the guide for alignment.
                drawBoundingBox(result.face_location, 'green');
            }
        }
    } catch (error) {
        console.error('Error during live identification:', error);
        cameraStatusElement.textContent = 'Network error. Retrying...';
    } finally {
        // Allow the next attempt to run only if the process is not stopping.
        if (identificationInterval) { // If interval is cleared, we are stopping.
            identificationInProgress = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const closeButton = document.getElementById('close-camera-modal');
    if (closeButton) {
        closeButton.addEventListener('click', stopWebcam);
    }
});

async function fetchAttendanceHistory() {
    const tableBody = document.getElementById('attendance-history-table-body');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '<tr><td colspan="7" class="py-4 px-6 text-center text-gray-500 italic"><i class="fas fa-spinner fa-spin mr-2"></i>Loading attendance history...</td></tr>';

    try {
        const response = await fetch('/Student/attendance-history');
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        tableBody.innerHTML = ''; 

        if (data.success && data.history && data.history.length > 0) {
            data.history.forEach((record, index) => {
                const row = tableBody.insertRow();
                row.className = index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100';
                // Correctly formatted template literal
                row.innerHTML = `
                    <td class="py-3 px-4 md:px-6 text-sm text-gray-700">${index + 1}</td>
                    <td class="py-3 px-4 md:px-6 text-sm text-gray-900 font-medium">${record.student_name || 'N/A'}</td>
                    <td class="py-3 px-4 md:px-6 text-sm text-gray-700">${record.student_semester || 'N/A'}</td>
                    <td class="py-3 px-4 md:px-6 text-sm text-gray-700">${new Date(record.class_date).toLocaleString()}</td>
                    <td class="py-3 px-4 md:px-6 text-sm text-gray-700">${record.subject || 'N/A'}</td>
                    <td class="py-3 px-4 md:px-6 text-sm text-gray-700">${record.class || 'N/A'}</td>
                    <td class="py-3 px-4 md:px-6 text-sm font-semibold ${record.status === 'Present' ? 'text-green-600' : 'text-red-600'}">${record.status || 'N/A'}</td>
                `;
            });
        } else {
            tableBody.innerHTML = `<tr><td colspan="7" class="py-4 px-6 text-center text-red-500 italic">${data.message || 'Failed to load history.'}</td></tr>`;
        }
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="7" class="py-4 px-6 text-center text-red-500 italic">Error loading history. Check console.</td></tr>';
    }
}

//--- Webcam and Attendance Functions ---

function resetCaptureState() {
    const markAttendanceBtn = document.getElementById('mark-attendance-btn');
    const cancelBtn = document.getElementById('cancel-capture-btn');
    const cameraContainer = document.getElementById('camera-container');
    const attendanceMessage = document.getElementById('attendance-message');
    const realtimeStatusOverlay = document.getElementById('realtime-status-overlay');

    if (markAttendanceBtn) markAttendanceBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
    if (cameraContainer) cameraContainer.classList.add('hidden');
    if (attendanceMessage) {
        attendanceMessage.textContent = 'Click \"Mark My Attendance\" to start the camera.';
        attendanceMessage.className = 'text-sm font-medium text-gray-600 dark:text-gray-300';
    }
    if (realtimeStatusOverlay) realtimeStatusOverlay.classList.add('hidden');
    clearBoundingBox();
}

async function startWebcam() {
    try {
        // Clear any previous cancellation flags before starting a new session
        await fetch('/Student/clear-cancellation-flag', { method: 'POST' });
    } catch (error) {
        console.error('Could not clear cancellation flag:', error);
        // Decide if you want to proceed or show an error to the user
    }
    const video = document.getElementById('webcam-feed');
    const cameraContainer = document.getElementById('camera-container');
    const markAttendanceBtn = document.getElementById('mark-attendance-btn');
    const cancelBtn = document.getElementById('cancel-capture-btn');
    const cameraStatus = document.getElementById('camera-status');
    const attendanceMessage = document.getElementById('attendance-message');

    if (!video || !cameraContainer || !markAttendanceBtn || !cancelBtn || !cameraStatus || !attendanceMessage) {
        alert('Required camera elements are not found. Please refresh the page.');
        return;
    }

    markAttendanceBtn.disabled = true;
    cancelBtn.disabled = false;
    cameraContainer.classList.remove('hidden');
    attendanceMessage.textContent = '';
    cameraStatus.textContent = 'Starting camera...';

    try {
        window.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        video.srcObject = window.stream;
        video.onloadedmetadata = () => {
            video.play();
            cameraStatus.textContent = 'Camera is on. Align your face.';
            if (identificationInterval) clearInterval(identificationInterval);
            identificationInterval = setInterval(attemptLiveIdentification, IDENTIFICATION_INTERVAL_MS);
        };
    } catch (err) {
        cameraStatus.textContent = 'Camera access denied or not available.';
        attendanceMessage.textContent = 'Please allow camera access to mark your attendance.';
        resetCaptureState();
    }
}

function stopWebcam() {
    fetch('/Student/cancel-attendance', { method: 'POST' })
        .then(res => res.json())
        .then(data => console.log('Cancellation signal sent:', data.message))
        .catch(err => console.error('Error sending cancellation signal:', err));
    const video = document.getElementById('webcam-feed');
    if (identificationInterval) {
        clearInterval(identificationInterval);
        identificationInterval = null;
    }
    if (window.stream) {
        window.stream.getTracks().forEach(track => track.stop());
        window.stream = null;
    }
    if (video) {
        video.pause();
        video.srcObject = null;
    }
    resetCaptureState();
}

document.addEventListener('DOMContentLoaded', function() {
  updateStudentClock();
  setInterval(updateStudentClock, 1000);
  loadStudentProfileData(); // Load profile data for header/sidebar
  loadUpcomingClassesForStudent();
  loadRecentAnnouncementsForStudent();



  const pathSegments = window.location.pathname.split('/');
  let initialSection = 'student-dashboard';
  // Check for /Student/dashboard/sectionName
  if (pathSegments.length > 3 && pathSegments[1] === 'Student' && pathSegments[2] === 'dashboard' && pathSegments[3]) {
    initialSection = pathSegments[3];
  } else if (pathSegments.length === 3 && pathSegments[1] === 'Student' && pathSegments[2] === 'dashboard') {
    initialSection = 'student-dashboard'; // For /Student/dashboard or /Student/dashboard/
  }

  const firstLink = document.getElementById(`nav-${initialSection}`) || 
                    document.querySelector(`.sidebar-link[onclick*="showStudentSection('${initialSection}'"]`);
  showStudentSection(initialSection, firstLink);

  // Profile Update Form
  const studentProfileForm = document.getElementById('studentProfileForm');
  if (studentProfileForm) {
    // ... existing code ...
  }

  document.addEventListener('click', function(event) {
    const target = event.target;
    // Corrected condition: Check if the click is on the toggle button itself or within the dropdown menu
    const isToggleButton = target.closest('#student-profile-dropdown-button');
    const isInsideDropdownMenu = target.closest('.dropdown-menu');

    if (!isToggleButton && !isInsideDropdownMenu) {
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });
});

window.addEventListener('popstate', function(event) {
  let sectionId = 'student-dashboard'; // Default section
  if (event.state && event.state.section) {
    sectionId = event.state.section;
  } else {
    const pathSegments = window.location.pathname.split('/');
    // Expected: ['', 'Student', 'dashboard', 'sectionName']
    if (pathSegments.length > 3 && pathSegments[1] === 'Student' && pathSegments[2] === 'dashboard' && pathSegments[3]) {
      sectionId = pathSegments[3];
    } else if (pathSegments.length === 3 && pathSegments[1] === 'Student' && pathSegments[2] === 'dashboard'){
        sectionId = 'student-dashboard'; // For /Student/dashboard or /Student/dashboard/
    }
  }
  const navLink = document.getElementById(`nav-${sectionId}`) || 
                  document.querySelector(`.sidebar-link[onclick*="showStudentSection('${sectionId}'"]`);
  showStudentSection(sectionId, navLink);
}); 