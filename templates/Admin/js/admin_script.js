// Mock student data
let students = [
]

let adminSemesterChart; // To hold the chart instance

// Function to show specific section and hide others
function showSection(sectionId, navElement) {
  const sections = document.querySelectorAll('main section');
  sections.forEach(section => {
    section.classList.add('hidden');
  });
  document.getElementById(sectionId + '-content').classList.remove('hidden');

  // Update main title
  const titleMap = {
      'dashboard': 'Dashboard',
      'manage-students': 'Manage Students',
      'reports': 'Reports',
      'settings': 'Settings',
      'admin-profile': 'Admin Profile'
  };
  document.getElementById('main-title').textContent = titleMap[sectionId] || 'Dashboard';

  // Update active sidebar link
  document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
  if (navElement) {
      navElement.classList.add('active');
  } else {
      // Fallback if navElement is not passed (e.g. for profile from dropdown)
      const fallbackNav = document.getElementById(`nav-${sectionId}`);
      if(fallbackNav) fallbackNav.classList.add('active');
  }
}

// Function to toggle dropdown menus
function toggleDropdown(dropdownId) {
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
        // Check if the click is outside the dropdown itself
        if (!openDropdown.contains(event.target)) {
           openDropdown.style.display = 'none';
        }
      }
    }
  }
}

// Clock Function
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('clock').innerHTML = `${timeString} <br> <span class="text-xs">${dateString}</span>`;
}

// Student Chart Function
function setupStudentChart() {
  const ctx = document.getElementById('adminSemesterChart').getContext('2d');
  const semesterCounts = students.reduce((acc, student) => {
    acc[student.semester] = (acc[student.semester] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(semesterCounts).map(s => `Semester ${s}`);
  const data = Object.values(semesterCounts);

  adminSemesterChart = new Chart(ctx, {
    type: 'bar', // Changed to bar for better semester representation
    data: {
      labels: labels,
      datasets: [{
        label: 'Number of Students',
        data: data,
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)', // Blue
          'rgba(75, 192, 192, 0.6)', // Green
          'rgba(255, 206, 86, 0.6)', // Yellow
          'rgba(153, 102, 255, 0.6)', // Purple
          'rgba(255, 159, 64, 0.6)',  // Orange
          'rgba(255, 99, 132, 0.6)',  // Red
          'rgba(201, 203, 207, 0.6)', // Grey
          'rgba(100, 150, 200, 0.6)'  // Another Blue
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(201, 203, 207, 1)',
          'rgba(100, 150, 200, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
              display: true,
              text: 'Number of Students'
          }
        },
        x: {
          title: {
              display: true,
              text: 'Semester'
          }
        }
      },
      plugins: {
          legend: {
              display: false // Hiding legend as it's a single dataset
          }
      }
    }
  });
}

function updateStudentChart(semester) {
  let filteredStudents = students;
  if (semester !== 'all') {
    filteredStudents = students.filter(s => s.semester === parseInt(semester));
  }

  const semesterCounts = filteredStudents.reduce((acc, student) => {
    acc[student.semester] = (acc[student.semester] || 0) + 1;
    return acc;
  }, {});
  
  let labels, data;
  if (semester === 'all') {
      const allSemesterCounts = students.reduce((acc, student) => {
          acc[student.semester] = (acc[student.semester] || 0) + 1;
          return acc;
      }, {});
      labels = Object.keys(allSemesterCounts).sort((a,b) => a-b).map(s => `Semester ${s}`);
      data = labels.map(label => {
          const semNum = parseInt(label.replace('Semester ', ''));
          return allSemesterCounts[semNum] || 0;
      });
  } else {
      labels = [`Semester ${semester}`];
      data = [semesterCounts[semester] || 0];
  }
  
  adminSemesterChart.data.labels = labels;
  adminSemesterChart.data.datasets[0].data = data;
  adminSemesterChart.update();
}

// Manage Students Functions
function renderStudentTable(filteredStudents = students) {
  const tableBody = document.getElementById('student-table-body');
  const noStudentsMessage = document.getElementById('no-students-message');
  tableBody.innerHTML = ''; // Clear existing rows

  if (filteredStudents.length === 0) {
      noStudentsMessage.classList.remove('hidden');
      tableBody.classList.add('hidden');
  } else {
      noStudentsMessage.classList.add('hidden');
      tableBody.classList.remove('hidden');
      filteredStudents.forEach(student => {
      const row = `
          <tr class="border-b hover:bg-gray-50">
          <td class="py-3 px-4">${student.id}</td>
          <td class="py-3 px-4">${student.name}</td>
          <td class="py-3 px-4">${student.email}</td>
          <td class="py-3 px-4 text-center">${student.semester}</td>
          <td class="py-3 px-4">
              <span class="px-2 py-1 text-xs font-semibold rounded-full ${
              student.status === 'Active' ? 'bg-green-100 text-green-800' : 
              student.status === 'Inactive' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'
              }">${student.status}</span>
          </td>
          <td class="py-3 px-4 text-center space-x-2">
              <button onclick="openEditStudentModal('${student.id}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i> Update</button>
              <button onclick="deleteStudent('${student.id}')" class="text-red-600 hover:text-red-800"><i class="fas fa-trash-alt"></i> Delete</button>
          </td>
          </tr>
      `;
      tableBody.innerHTML += row;
      });
  }
  document.getElementById('total-students-display').textContent = filteredStudents.length;
  document.getElementById('total-students-card').textContent = students.length; // Overall total
}

function filterStudentsBySemester(semester) {
  if (semester === 'all') {
    renderStudentTable(students);
  } else {
    const filtered = students.filter(s => s.semester === parseInt(semester));
    renderStudentTable(filtered);
  }
}

// Modal Functions for Add Student Modal
function showAddStudentModal() {
  const modal = document.getElementById('add-student-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddStudentModal() {
  const modal = document.getElementById('add-student-modal');
  if (modal) {
    modal.classList.add('hidden');
    // Optionally reset the form
    const form = document.getElementById('add-student-form');
    if (form) form.reset();
  } else {
    console.error("Element with id 'add-student-modal' not found.");
  }
  // Show the manage student section
  if (typeof showSection === 'function') {
    showSection('manage-student', document.getElementById('nav-manage-student'));
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Attach open modal to Add New Student button by ID
  const addBtn = document.getElementById('add-student-btn');
  if (addBtn) {
    addBtn.onclick = showAddStudentModal;
  }
  // Attach close modal to Close button by ID
  const closeBtn = document.getElementById('close-student-modal-btn');
  if (closeBtn) {
    closeBtn.onclick = closeAddStudentModal;
  }
  // Modal background click closes modal
  const modal = document.getElementById('add-student-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeAddStudentModal();
      }
    });
  }
  // Add Student Form Submit
  const form = document.getElementById('add-student-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      // Validate photo input manually
      const photoInput = document.getElementById('student-photo');
      if (!photoInput || !photoInput.files || photoInput.files.length === 0) {
        alert('Please select a photo.');
        return;
      }
      // You can add AJAX form submission here if needed
      // For now, just close the modal
      closeAddStudentModal();
    });
  }
  // Initial setup
  showSection('dashboard', document.getElementById('nav-dashboard'));
  updateClock();
  setInterval(updateClock, 1000);
  setupStudentChart();
  renderStudentTable();
  document.getElementById('total-students-card').textContent = students.length;
});