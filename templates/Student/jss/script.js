  // Mock attendance data
  let attendanceRecords = [
    { date: '2024-05-01', subject: 'Math 101', status: 'Present', markedAt: '09:05 AM' },
    { date: '2024-05-01', subject: 'Physics 202', status: 'Present', markedAt: '11:02 AM' },
    { date: '2024-05-02', subject: 'Math 101', status: 'Absent', markedAt: '-' },
    { date: '2024-05-03', subject: 'History 100', status: 'Present', markedAt: '01:00 PM' },
  ];

  // Function to show specific section and hide others
  function showStudentSection(sectionId, navElement) {
    const sections = document.querySelectorAll('main section');
    sections.forEach(section => {
      section.classList.add('hidden');
    });
    document.getElementById(sectionId + '-content').classList.remove('hidden');

    // Update main title
     const titleMap = {
        'student-dashboard': 'Dashboard',
        'my-attendance': 'My Attendance',
        'my-courses': 'My Courses',
        'student-profile': 'My Profile'
    };
    document.getElementById('student-main-title').textContent = titleMap[sectionId] || 'Dashboard';


    // Update active sidebar link
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
     if (navElement) {
        navElement.classList.add('active');
    } else {
        const fallbackNav = document.getElementById(`nav-${sectionId}`);
        if(fallbackNav) fallbackNav.classList.add('active');
    }
  }

  // Function to toggle dropdown menus
  function toggleStudentDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  }

  // Close dropdown if clicked outside
  window.onclick = function(event) {
    if (!event.target.matches('button') && !event.target.closest('button')) {
      const dropdowns = document.getElementsByClassName("dropdown-menu");
      for (let i = 0; i < dropdowns.length; i++) {
        let openDropdown = dropdowns[i];
        if (openDropdown.style.display === 'block') {
             if (!openDropdown.contains(event.target)) {
                openDropdown.style.display = 'none';
            }
        }
      }
    }
  }

  // Clock Function
  function updateStudentClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    document.getElementById('student-clock').innerHTML = `${timeString} <br> <span class="text-xs">${dateString}</span>`;
  }

  // Attendance Functions
  function renderAttendanceTable() {
    const tableBody = document.getElementById('attendance-table-body');
    const noAttendanceMessage = document.getElementById('no-attendance-message');
    tableBody.innerHTML = ''; // Clear existing rows

    if (attendanceRecords.length === 0) {
        noAttendanceMessage.classList.remove('hidden');
        tableBody.classList.add('hidden');
    } else {
        noAttendanceMessage.classList.add('hidden');
        tableBody.classList.remove('hidden');
        attendanceRecords.sort((a,b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
        attendanceRecords.forEach(record => {
        const row = `
            <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4">${new Date(record.date).toLocaleDateString()}</td>
            <td class="py-3 px-4">${record.subject}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">${record.status}</span>
            </td>
            <td class="py-3 px-4">${record.markedAt}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
        });
    }
  }

  function markAttendance() {
    const attendanceMessage = document.getElementById('attendance-message');
    const cameraSim = document.getElementById('camera-simulation');
    
    attendanceMessage.textContent = 'Attempting to mark attendance...';
    cameraSim.classList.remove('hidden');

    // Simulate camera access and marking
    setTimeout(() => {
        cameraSim.classList.add('hidden');
        const today = new Date();
        const newRecord = {
            date: today.toISOString().split('T')[0],
            subject: 'Current Class', // This would ideally be dynamic
            status: 'Present',
            markedAt: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        // Avoid duplicate for same day, same subject (simple check)
        const existing = attendanceRecords.find(r => r.date === newRecord.date && r.subject === newRecord.subject);
        if (!existing) {
            attendanceRecords.push(newRecord);
            renderAttendanceTable();
            attendanceMessage.textContent = `Attendance marked for ${newRecord.subject} at ${newRecord.markedAt}.`;
            attendanceMessage.className = 'text-sm text-green-600 font-medium';
        } else {
            attendanceMessage.textContent = `Attendance already marked for ${newRecord.subject} today.`;
            attendanceMessage.className = 'text-sm text-yellow-600 font-medium';
        }

    }, 2000); // Simulate 2 seconds for camera
  }

  // Initial setup
  document.addEventListener('DOMContentLoaded', () => {
    showStudentSection('student-dashboard', document.getElementById('nav-student-dashboard')); // Show dashboard by default
    updateStudentClock();
    setInterval(updateStudentClock, 1000); // Update clock every second
    renderAttendanceTable();
  });
