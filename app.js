// EcoSmart Application Logic
import { 
    ref, 
    get, 
    set, 
    push, 
    update, 
    remove, 
    onValue, 
    off,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Global state
let currentUser = null;
let currentPage = 'main-menu';
let studentsData = {};
let gradesData = {}; // To store grades from Firebase
let statisticsData = {};
let currentFilter = 'all';
let editingStudentCode = null;
let editingGradeName = null; // For grade editing
let notificationQueue = [];
let notificationInterval = null;
let studentToIncreasePoints = null; // Stores student code for add points modal

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    startNotificationSystem();
});

async function initializeApp() {
    try {
        // Show loading screen
        showLoadingScreen();
        
        // Load grades (both default and custom)
        await loadGrades();
        
        // Initialize sample data if needed
        await initializeSampleData();
        
        // Load initial statistics
        await loadStatistics();
        
        // Hide loading screen and show main menu
        setTimeout(() => {
            hideLoadingScreen();
            showMainMenu();
        }, 2000);
        
        console.log('EcoSmart initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error al inicializar la aplicación', 'error');
        hideLoadingScreen();
    }
}

// Notification System
function startNotificationSystem() {
    // Listen for changes in students data for real-time notifications
    const studentsRef = ref(window.database, 'students');
    onValue(studentsRef, (snapshot) => {
        if (snapshot.exists()) {
            const newStudentsData = snapshot.val();
            checkForNotifications(newStudentsData);
        }
    });
    
    // Start notification display interval
    notificationInterval = setInterval(displayNextNotification, 4000);
}

function checkForNotifications(newData) {
    if (!studentsData || Object.keys(studentsData).length === 0) {
        studentsData = newData;
        return;
    }
    
    // Check for new students or point updates
    for (const [code, data] of Object.entries(newData)) {
        if (!studentsData[code]) {
            // New student joined
            addNotification(`¡Un nuevo estudiante se ha unido: ${data.nombre} del grado ${data.grado}! 🎉`, 'success');
        } else if (studentsData[code].puntos !== data.puntos) {
            // Points updated
            const pointsDiff = data.puntos - studentsData[code].puntos;
            if (pointsDiff > 0) {
                addNotification(`¡Felicidades 🎉 ${data.nombre} (${data.grado}) sumó +${pointsDiff} puntos!`, 'success');
            }
        }
    }
    
    studentsData = newData;
}

function addNotification(message, type = 'info') {
    notificationQueue.push({ message, type, timestamp: Date.now() });
}

function displayNextNotification() {
    if (notificationQueue.length === 0) return;
    
    const notification = notificationQueue.shift();
    showRealtimeNotification(notification.message, notification.type);
}

function showRealtimeNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `realtime-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.getElementById('notification-container');
    container.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Grade Management
async function loadGrades() {
    try {
        const gradesRef = ref(window.database, 'grades');
        const snapshot = await get(gradesRef);
        
        if (snapshot.exists()) {
            gradesData = snapshot.val();
        } else {
            // If no grades exist, initialize with default ones
            for (const grade of ['6-1', '6-2', '6-3', '7-1', '7-2', '7-3']) {
                await set(ref(window.database, `grades/${grade}`), true);
            }
            gradesData = { '6-1': true, '6-2': true, '6-3': true, '7-1': true, '7-2': true, '7-3': true };
        }
        updateAllGradeSelectors(); // Update all selectors after loading grades
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

function getAvailableGrades() {
    return Object.keys(gradesData).sort();
}

function updateAllGradeSelectors() {
    const availableGrades = getAvailableGrades();

    // Update Add Student Modal grade selector
    const newStudentGradeSelect = document.getElementById('new-student-grade');
    populateGradeSelect(newStudentGradeSelect, availableGrades);

    // Update Edit Student Modal grade selector
    const editStudentGradeSelect = document.getElementById('edit-student-grade');
    populateGradeSelect(editStudentGradeSelect, availableGrades);

    // Update Guest Access grade filters
    const guestGradeFilters = document.getElementById('guest-grade-filters');
    if (guestGradeFilters) {
        guestGradeFilters.innerHTML = '<button class="filter-btn active" onclick="filterByGrade(\'all\')">Todos</button>';
        availableGrades.forEach(grade => {
            guestGradeFilters.innerHTML += `<button class="filter-btn" onclick="filterByGrade('${grade}')">${grade}</button>`;
        });
    }

    // Update Export Data grade filter
    const exportGradeFilter = document.getElementById('export-grade-filter');
    populateGradeSelect(exportGradeFilter, availableGrades, true); // Add 'all' option
}

function populateGradeSelect(selectElement, grades, includeAllOption = false) {
    selectElement.innerHTML = '';
    if (includeAllOption) {
        selectElement.innerHTML += '<option value="all">Todos los grados</option>';
    } else {
        selectElement.innerHTML += '<option value="">Seleccionar grado</option>';
    }
    grades.forEach(grade => {
        selectElement.innerHTML += `<option value="${grade}">${grade}</option>`;
    });
    if (!includeAllOption) {
        selectElement.innerHTML += '<option value="custom">Otro (personalizado)</option>';
    }
}

// Loading screen functions
function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none';
}

// Navigation functions
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;
}

function showMainMenu() {
    showPage('main-menu');
    loadMainMenuStats();
    loadGradeChart();
}

// Function to generate a unique, consistent color for each grade
function getGradeColor(gradeName) {
    // A set of distinct colors for grades
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#E7E9ED', '#8D6E63', '#FFD700', '#ADFF2F', '#FF69B4', '#1E90FF',
        '#2ECC40', '#FF851B', '#7FDBFF', '#B10DC9', '#FFDC00', '#001F3F'
    ];
    let hash = 0;
    for (let i = 0; i < gradeName.length; i++) {
        hash = gradeName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function loadGradeChart() {
    // Ensure studentsData is loaded
    if (!studentsData || Object.keys(studentsData).length === 0) {
        document.querySelector('#grade-chart .grade-chart-content').innerHTML = '<p class="no-data-message">No hay datos de estudiantes para mostrar el ranking de grados.</p>';
        return;
    }
    
    // Calculate points by grade and find the top student within each grade
    const gradeStats = {};
    getAvailableGrades().forEach(grade => {
        gradeStats[grade] = { totalPoints: 0, topStudent: null };
    });
    
    Object.values(studentsData).forEach(student => {
        const grade = student.grado;
        if (gradeStats.hasOwnProperty(grade)) {
            gradeStats[grade].totalPoints += student.puntos || 0;
            if (!gradeStats[grade].topStudent || student.puntos > gradeStats[grade].topStudent.puntos) {
                gradeStats[grade].topStudent = { name: student.nombre, points: student.puntos };
            }
        }
    });
    
    // Sort grades by total points descending
    const sortedGrades = Object.entries(gradeStats).sort(([, a], [, b]) => b.totalPoints - a.totalPoints);
    
    const chartContainer = document.querySelector('#grade-chart .grade-chart-content');
    if (chartContainer) {
        if (sortedGrades.length === 0 || sortedGrades.every(([, stats]) => stats.totalPoints === 0)) {
            chartContainer.innerHTML = '<p class="no-data-message">No hay datos de ranking de grados disponibles.</p>';
            return;
        }

        let chartHTML = '<div class="grade-chart-grid">';
        
        sortedGrades.forEach(([grade, stats]) => {
            const gradeColor = getGradeColor(grade);
            const topStudentInfo = stats.topStudent ? 
                `<p class="top-student-info">Líder: ${sanitizeHTML(stats.topStudent.name)} (${stats.topStudent.points} pts)</p>` : 
                '<p class="top-student-info">Sin líder aún</p>';

            chartHTML += `
                <div class="grade-card" style="border-color: ${gradeColor};">
                    <div class="grade-card-header" style="background-color: ${gradeColor};">
                        <h4>${grade}</h4>
                    </div>
                    <div class="grade-card-body">
                        <p class="grade-total-points">Total: <strong>${stats.totalPoints}</strong> puntos</p>
                        ${topStudentInfo}
                        <button onclick="viewGradeStudents('${sanitizeHTML(grade)}')" class="btn btn-primary btn-sm view-students-btn">
                            Ver todos los estudiantes
                        </button>
                    </div>
                </div>
            `;
        });
        
        chartHTML += '</div>';
        chartContainer.innerHTML = chartHTML;
    }
}


function showStudentLogin() {
    showPage('student-login');
    document.getElementById('student-code').value = '';
    hideError('student-login-error');
}

function showGuestAccess() {
    showPage('guest-access');
    loadRanking();
    updateAllGradeSelectors(); // Ensure grade filters are updated
}

function showAdminLogin() {
    showPage('admin-login');
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    hideError('admin-login-error');
}

// Student functions
async function loginStudent() {
    const code = document.getElementById('student-code').value.trim();
    
    if (!validateStudentCode(code)) {
        showError('student-login-error', 'Por favor ingresa un código válido de 4 dígitos');
        return;
    }
    
    try {
        const studentRef = ref(window.database, `students/${code}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists()) {
            currentUser = { code, ...snapshot.val() };
            showStudentDashboard();
        } else {
            showError('student-login-error', 'Código de estudiante no encontrado');
        }
    } catch (error) {
        console.error('Error logging in student:', error);
        showError('student-login-error', 'Error al acceder. Intenta nuevamente.');
    }
}

function showStudentDashboard() {
    showPage('student-dashboard');
    loadStudentData();
}

async function loadStudentData() {
    if (!currentUser) return;
    
    try {
        // Update student info
        document.getElementById('student-name').textContent = currentUser.nombre;
        document.getElementById('student-grade').textContent = currentUser.grado;
        document.getElementById('student-points').textContent = currentUser.puntos || 0;
        
        // Load ranking data
        await loadStudentRanking();
        
        // Load student history
        loadStudentHistory();
        
    } catch (error) {
        console.error('Error loading student data:', error);
        showToast('Error al cargar datos del estudiante', 'error');
    }
}

async function loadStudentRanking() {
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (snapshot.exists()) {
            const students = snapshot.val();
            const studentsList = Object.entries(students).map(([code, data]) => ({
                code,
                ...data,
                puntos: data.puntos || 0
            }));
            
            // Sort by points
            studentsList.sort((a, b) => b.puntos - a.puntos);
            
            // Find general ranking
            const globalRankIndex = studentsList.findIndex(s => s.code === currentUser.code);
            const globalRank = globalRankIndex !== -1 ? globalRankIndex + 1 : -1;
            document.getElementById('general-rank').textContent = globalRank !== -1 ? `#${globalRank}` : 'N/A';
            
            // Find grade ranking
            const gradeStudents = studentsList.filter(s => s.grado === currentUser.grado);
            gradeStudents.sort((a, b) => b.puntos - a.puntos); // Sort grade students
            const gradeRankIndex = gradeStudents.findIndex(s => s.code === currentUser.code);
            const gradeRank = gradeRankIndex !== -1 ? gradeRankIndex + 1 : -1;
            document.getElementById('grade-rank').textContent = gradeRank !== -1 ? `#${gradeRank}` : 'N/A';
            
            // Calculate points needed for top positions
            calculatePointsNeeded(studentsList, currentUser.puntos || 0, globalRank);
        }
    } catch (error) {
        console.error('Error loading student ranking:', error);
    }
}

function calculatePointsNeeded(allStudents, currentPoints, currentGlobalRank) {
    const topRanks = [1, 2, 3, 4];
    topRanks.forEach(rank => {
        const targetElementId = `stats-to-top${rank}`; // For student stats modal
        const dashboardElementId = `points-to-top${rank}`; // For student dashboard
        const dashboardContainerId = `progress-to-top${rank}-container`;

        const dashboardElement = document.getElementById(dashboardElementId);
        const statsElement = document.getElementById(targetElementId);
        const dashboardContainer = document.getElementById(dashboardContainerId);
        const statsContainer = statsElement ? statsElement.parentElement : null;

        // Hide containers by default
        if (dashboardContainer) dashboardContainer.style.display = 'none';
        if (statsContainer) statsContainer.style.display = 'none';

        if (allStudents.length >= rank) {
            const topNStudent = allStudents[rank - 1];
            const targetPoints = topNStudent.puntos;

            // If the student is already at or above this rank
            if (currentGlobalRank !== -1 && currentGlobalRank <= rank) {
                // Only show "Ya eres Top X!" for the exact rank they are in, or the highest rank they are in
                // For example, if Top 2, don't show "Ya eres Top 3!"
                if (currentGlobalRank === rank) {
                    if (dashboardElement) dashboardElement.textContent = `¡Ya eres Top ${rank}!`;
                    if (statsElement) statsElement.textContent = `¡Ya eres Top ${rank}!`;
                    if (dashboardContainer) dashboardContainer.display = 'flex'; // Show if it's their current rank
                    if (statsContainer) statsContainer.style.display = 'flex';
                }
                // If currentGlobalRank < rank, it means they are better than this rank, so hide it.
            } else {
                // Student is ranked lower than 'rank', so they need to reach it
                const pointsNeeded = Math.max(0, targetPoints - currentPoints + (currentPoints <= targetPoints ? 1 : 0));
                
                if (pointsNeeded > 0) { // Only show if points are actually needed
                    if (dashboardElement) dashboardElement.textContent = `${pointsNeeded} puntos`;
                    if (statsElement) statsElement.textContent = `${pointsNeeded} puntos`;
                    if (dashboardContainer) dashboardContainer.style.display = 'flex';
                    if (statsContainer) statsContainer.style.display = 'flex';
                }
            }
        }
    });
}


function loadStudentHistory() {
    if (!currentUser || !currentUser.historial) {
        document.getElementById('student-history').innerHTML = '<p class="no-data">Sin actividad reciente</p>';
        return;
    }
    
    const history = Object.entries(currentUser.historial)
        .sort(([a], [b]) => new Date(parseInt(b)) - new Date(parseInt(a))) // Ensure parsing as int
        .slice(0, 5);
    
    if (history.length === 0) {
        document.getElementById('student-history').innerHTML = '<p class="no-data">Sin actividad reciente</p>';
        return;
    }
    
    const historyHTML = history.map(([timestamp, points]) => {
        const date = new Date(parseInt(timestamp)); // Parse timestamp as integer
        const formattedDate = date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="history-item">
                <span class="history-date">${formattedDate}</span>
                <span class="history-points">+${points} puntos</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('student-history').innerHTML = historyHTML;
}

// Guest access functions
async function loadRanking() {
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (snapshot.exists()) {
            studentsData = snapshot.val();
            displayRanking();
            updateRankingStats();
        } else {
            document.getElementById('ranking-tbody').innerHTML = 
                '<tr><td colspan="4" class="loading-row">No hay estudiantes registrados</td></tr>';
        }
    } catch (error) {
        console.error('Error loading ranking:', error);
        document.getElementById('ranking-tbody').innerHTML = 
            '<tr><td colspan="4" class="loading-row">Error al cargar el ranking</td></tr>';
    }
}

function displayRanking() {
    const students = Object.entries(studentsData).map(([code, data]) => ({
        code,
        ...data,
        puntos: data.puntos || 0
    }));
    
    // Filter by grade if needed
    let filteredStudents = students;
    if (currentFilter !== 'all') {
        filteredStudents = students.filter(student => student.grado === currentFilter);
    }
    
    // Sort by points
    filteredStudents.sort((a, b) => b.puntos - a.puntos);
    
    if (filteredStudents.length === 0) {
        document.getElementById('ranking-tbody').innerHTML = 
            '<tr><td colspan="4" class="loading-row">No hay estudiantes en este grado</td></tr>';
        return;
    }
    
    const rankingHTML = filteredStudents.map((student, index) => {
        const position = index + 1;
        const positionClass = position <= 3 ? `position-${position}` : 'position-other';
        
        return `
            <tr>
                <td>
                    <span class="position-badge ${positionClass}">${position}</span>
                </td>
                <td>${sanitizeHTML(student.nombre)}</td>
                <td>
                    <span class="grade-badge">${student.grado}</span>
                </td>
                <td><strong>${student.puntos}</strong></td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('ranking-tbody').innerHTML = rankingHTML;
}

function filterByGrade(grade) {
    currentFilter = grade;
    
    // Update active filter button
    document.querySelectorAll('#guest-grade-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // Find the clicked button by its onclick attribute or value
    const clickedButton = Array.from(document.querySelectorAll('#guest-grade-filters .filter-btn')).find(btn => 
        btn.getAttribute('onclick') === `filterByGrade('${grade}')` || btn.textContent === grade
    );
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    displayRanking();
}

function updateRankingStats() {
    const students = Object.values(studentsData);
    const totalBottles = students.reduce((sum, student) => sum + (student.puntos || 0), 0);
    const activeStudents = students.filter(student => (student.puntos || 0) > 0).length;
    
    document.getElementById('ranking-total-bottles').textContent = totalBottles;
    document.getElementById('ranking-active-students').textContent = activeStudents;
}

// Admin functions
async function loginAdmin() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    
    if (!username || !password) {
        showError('admin-login-error', 'Por favor completa todos los campos');
        return;
    }
    
    try {
        const adminRef = ref(window.database, 'admins/admin1');
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
            const adminData = snapshot.val();
            if (adminData.usuario === username && adminData.contraseña === password) {
                currentUser = { username, role: 'admin' };
                showAdminDashboard();
            } else {
                showError('admin-login-error', 'Credenciales incorrectas');
            }
        } else {
            showError('admin-login-error', 'Error de autenticación');
        }
    } catch (error) {
        console.error('Error logging in admin:', error);
        showError('admin-login-error', 'Error al iniciar sesión. Intenta nuevamente.');
    }
}

function showAdminDashboard() {
    showPage('admin-dashboard');
    document.getElementById('admin-welcome').textContent = `Bienvenido, ${currentUser.username}`;
    showAdminTab('students');
    loadAdminData();
}

function logoutAdmin() {
    currentUser = null;
    showMainMenu();
}

function showAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="showAdminTab('${tabName}')"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`admin-${tabName}`).classList.add('active');
    
    // Load tab-specific data
    switch (tabName) {
        case 'students':
            loadStudentsTable();
            break;
        case 'grades':
            loadGradesTable();
            break;
        case 'statistics':
            loadAdminStatistics();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'export':
            loadExportOptions();
            break;
    }
}

async function loadAdminData() {
    try {
        await loadStudentsTable();
        await loadGradesTable(); // Load grades table on admin dashboard load
        await loadAdminStatistics();
        await loadSettings();
        await loadExportOptions();
    } catch (error) {
        console.error('Error loading admin data:', error);
        showToast('Error al cargar datos administrativos', 'error');
    }
}

async function loadStudentsTable() {
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (snapshot.exists()) {
            const students = snapshot.val();
            const studentsList = Object.entries(students).map(([code, data]) => ({
                code,
                ...data,
                puntos: data.puntos || 0
            }));
            
            // Sort by points descending
            studentsList.sort((a, b) => b.puntos - a.puntos);
            
            const studentsHTML = studentsList.map(student => `
                <tr>
                    <td><strong>${student.code}</strong></td>
                    <td>${sanitizeHTML(student.nombre)}</td>
                    <td><span class="grade-badge">${student.grado}</span></td>
                    <td><strong>${student.puntos}</strong></td>
                    <td>
                        <div class="action-buttons">
                            <button onclick="showAddPointsModal('${student.code}', '${sanitizeHTML(student.nombre)}', '${sanitizeHTML(student.grado)}')" class="btn btn-sm btn-success" title="Aumentar Puntos">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button onclick="showStudentStatsModal('${student.code}')" class="btn btn-sm btn-info" title="Ver Estadísticas">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="editStudent('${student.code}')" class="btn btn-sm btn-secondary" title="Editar Estudiante">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="confirmDeleteStudent('${student.code}', '${sanitizeHTML(student.nombre)}')" class="btn btn-sm btn-danger" title="Eliminar Estudiante">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
            
            document.getElementById('students-tbody').innerHTML = studentsHTML;
        } else {
            document.getElementById('students-tbody').innerHTML = 
                '<tr><td colspan="5" class="loading-row">No hay estudiantes registrados</td></tr>';
        }
    } catch (error) {
        console.error('Error loading students table:', error);
        document.getElementById('students-tbody').innerHTML = 
            '<tr><td colspan="5" class="loading-row">Error al cargar estudiantes</td></tr>';
    }
}

// New: Show Add Points Modal
function showAddPointsModal(code, name, grade) {
    studentToIncreasePoints = { code, name, grade };
    document.getElementById('add-points-student-name').textContent = name;
    document.getElementById('add-points-student-grade').textContent = grade;
    document.getElementById('points-to-add').value = 10; // Default value
    hideError('add-points-error');
    document.getElementById('add-points-modal').classList.add('active');
}

// New: Close Add Points Modal
function closeAddPointsModal() {
    document.getElementById('add-points-modal').classList.remove('active');
    studentToIncreasePoints = null;
}

// New: Confirm and Increase Student Points
async function confirmIncreaseStudentPoints() {
    if (!studentToIncreasePoints) return;

    const pointsToAdd = parseInt(document.getElementById('points-to-add').value);
    if (isNaN(pointsToAdd) || pointsToAdd < 1 || pointsToAdd > 15) {
        showError('add-points-error', 'Por favor ingresa un número de puntos entre 1 y 15.');
        return;
    }

    try {
        const { code, name, grade } = studentToIncreasePoints;
        const studentRef = ref(window.database, `students/${code}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists()) {
            const student = snapshot.val();
            const currentPoints = student.puntos || 0;
            const newPoints = currentPoints + pointsToAdd;
            
            // Add to history
            const historyTimestamp = Date.now();
            const updates = {};
            updates[`students/${code}/puntos`] = newPoints;
            updates[`students/${code}/historial/${historyTimestamp}`] = pointsToAdd;

            await update(ref(window.database), updates);
            
            showToast(`¡${name} (${grade}) sumó +${pointsToAdd} puntos!`, 'success');
            loadStudentsTable(); // Refresh table
            closeAddPointsModal();
        }
    } catch (error) {
        console.error('Error increasing student points:', error);
        showError('add-points-error', 'Error al aumentar puntos del estudiante', 'error');
    }
}


async function showStudentStatsModal(code) {
    try {
        const studentRef = ref(window.database, `students/${code}`);
        const studentSnapshot = await get(studentRef);

        if (!studentSnapshot.exists()) {
            showToast('Estudiante no encontrado', 'error');
            return;
        }

        const student = studentSnapshot.val();
        document.getElementById('stats-student-name').textContent = student.nombre;
        document.getElementById('stats-student-grade').textContent = student.grado;
        document.getElementById('stats-student-points').textContent = student.puntos || 0;

        const allStudentsRef = ref(window.database, 'students');
        const allStudentsSnapshot = await get(allStudentsRef);
        // CORRECTED: Ensure 'code' is mapped from Firebase key
        const studentsList = Object.entries(allStudentsSnapshot.val() || {}).map(([key, data]) => ({
            code: key, // Map the key as 'code'
            ...data,
            puntos: data.puntos || 0
        }));
        studentsList.sort((a, b) => b.puntos - a.puntos);

        const globalRankIndex = studentsList.findIndex(s => s.code === code);
        const globalRank = globalRankIndex !== -1 ? globalRankIndex + 1 : -1;
        document.getElementById('stats-global-rank').textContent = globalRank !== -1 ? `#${globalRank}` : 'N/A';

        const gradeStudents = studentsList.filter(s => s.grado === student.grado);
        gradeStudents.sort((a, b) => b.puntos - a.puntos);
        const gradeRankIndex = gradeStudents.findIndex(s => s.code === code);
        const gradeRank = gradeRankIndex !== -1 ? gradeRankIndex + 1 : -1;
        document.getElementById('stats-grade-rank').textContent = gradeRank !== -1 ? `#${gradeRank}` : 'N/A';

        // Calculate points needed for top positions
        calculatePointsNeeded(studentsList, student.puntos || 0, globalRank);

        document.getElementById('student-stats-modal').classList.add('active');
    } catch (error) {
        console.error('Error showing student stats modal:', error);
        showToast('Error al cargar estadísticas del estudiante', 'error');
    }
}

function closeStudentStatsModal() {
    document.getElementById('student-stats-modal').classList.remove('active');
}

// New: View Grade Students Modal
async function viewGradeStudents(gradeName) {
    document.getElementById('view-grade-students-title').textContent = gradeName;
    const studentsTbody = document.getElementById('view-grade-students-tbody');
    studentsTbody.innerHTML = '<tr><td colspan="3" class="loading-row">Cargando estudiantes...</td></tr>';

    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (snapshot.exists()) {
            const allStudents = snapshot.val();
            const gradeStudents = Object.entries(allStudents)
                .map(([code, data]) => ({ code, ...data, puntos: data.puntos || 0 }))
                .filter(student => student.grado === gradeName)
                .sort((a, b) => b.puntos - b.puntos); // Sort by points descending

            if (gradeStudents.length === 0) {
                studentsTbody.innerHTML = '<tr><td colspan="3" class="no-data">No hay estudiantes en este grado.</td></tr>';
            } else {
                let studentsHTML = '';
                gradeStudents.forEach((student, index) => {
                    const position = index + 1;
                    const positionClass = position <= 3 ? `position-${position}` : 'position-other';
                    studentsHTML += `
                        <tr>
                            <td><span class="position-badge ${positionClass}">${position}</span></td>
                            <td>${sanitizeHTML(student.nombre)}</td>
                            <td><strong>${student.puntos}</strong></td>
                        </tr>
                    `;
                });
                studentsTbody.innerHTML = studentsHTML;
            }
        } else {
            studentsTbody.innerHTML = '<tr><td colspan="3" class="no-data">No hay estudiantes registrados para este grado.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading grade students:', error);
        studentsTbody.innerHTML = '<tr><td colspan="3" class="no-data">Error al cargar estudiantes del grado.</td></tr>';
    }

    document.getElementById('view-grade-students-modal').classList.add('active');
}

// New: Close View Grade Students Modal
function closeViewGradeStudentsModal() {
    document.getElementById('view-grade-students-modal').classList.remove('active');
}


async function loadAdminStatistics() {
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (snapshot.exists()) {
            const students = snapshot.val();
            const studentsList = Object.values(students);
            
            const totalBottles = studentsList.reduce((sum, student) => sum + (student.puntos || 0), 0);
            const totalStudents = studentsList.length;
            const totalPoints = totalBottles; // Assuming 1 point per bottle
            
            document.getElementById('admin-total-bottles').textContent = totalBottles;
            document.getElementById('admin-total-students').textContent = totalStudents;
            document.getElementById('admin-total-points').textContent = totalPoints;
            
            // Load grade statistics
            loadGradeStatistics(students);
        }
    } catch (error) {
        console.error('Error loading admin statistics:', error);
    }
}

function loadGradeStatistics(students) {
    const gradeStats = {};
    
    // Initialize grade stats for all available grades
    getAvailableGrades().forEach(grade => {
        gradeStats[grade] = {
            students: 0,
            bottles: 0,
            activeStudents: 0
        };
    });
    
    // Calculate stats
    Object.values(students).forEach(student => {
        const grade = student.grado;
        if (gradeStats[grade]) { // Ensure grade exists in our loaded grades
            gradeStats[grade].students++;
            gradeStats[grade].bottles += student.puntos || 0;
            if ((student.puntos || 0) > 0) {
                gradeStats[grade].activeStudents++;
            }
        }
    });
    
    // Display grade stats, sorted by grade name
    const gradeStatsHTML = Object.entries(gradeStats)
        .sort(([gradeA], [gradeB]) => gradeA.localeCompare(gradeB))
        .map(([grade, stats]) => {
        return `
            <div class="grade-stat-item">
                <h5>${grade}</h5>
                <div class="stat-value">${stats.bottles}</div>
                <div class="stat-label">Botellas</div>
                <div class="stat-value">${stats.activeStudents}/${stats.students}</div>
                <div class="stat-label">Activos</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('grade-stats-container').innerHTML = gradeStatsHTML;
}

async function loadSettings() {
    try {
        const configRef = ref(window.database, 'config/puntosPorBotella');
        const snapshot = await get(configRef);
        
        const pointsPerBottle = snapshot.exists() ? snapshot.val() : 1;
        document.getElementById('points-per-bottle').value = pointsPerBottle;
    } catch (error) {
        console.error('Error loading settings:', error);
        document.getElementById('points-per-bottle').value = 1;
    }
}

// Export functionality
async function loadExportOptions() {
    // Set default dates
    const today = new Date();
    const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    document.getElementById('export-start-date').value = oneMonthAgo.toISOString().split('T')[0];
    document.getElementById('export-end-date').value = today.toISOString().split('T')[0];
    
    // Populate grade filter
    updateAllGradeSelectors(); // Ensure export grade filter is updated
}

async function exportData(format) {
    const startDate = document.getElementById('export-start-date').value;
    const endDate = document.getElementById('export-end-date').value;
    const gradeFilter = document.getElementById('export-grade-filter').value;
    const studentFilter = document.getElementById('export-student-filter').value.trim();
    
    if (!startDate || !endDate) {
        showToast('Por favor selecciona las fechas de inicio y fin', 'error');
        return;
    }
    
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (!snapshot.exists()) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        const students = snapshot.val();
        let exportData = Object.entries(students).map(([code, data]) => ({
            codigo: code,
            nombre: data.nombre,
            grado: data.grado,
            puntos: data.puntos || 0,
            historial: data.historial || {}
        }));
        
        // Apply filters
        if (gradeFilter !== 'all') {
            exportData = exportData.filter(student => student.grado === gradeFilter);
        }
        
        if (studentFilter) {
            exportData = exportData.filter(student => 
                student.nombre.toLowerCase().includes(studentFilter.toLowerCase()) ||
                student.codigo.includes(studentFilter)
            );
        }
        
        // Filter by date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        
        exportData = exportData.map(student => {
            const filteredHistory = {};
            for (const [timestamp, points] of Object.entries(student.historial)) {
                const date = new Date(parseInt(timestamp)); // Parse timestamp as integer
                if (date >= start && date <= end) {
                    filteredHistory[timestamp] = points;
                }
            }
            return { ...student, historial: filteredHistory };
        });
        
        // Generate export based on format
        switch (format) {
            case 'csv':
                exportToCSV(exportData);
                break;
            case 'excel':
                exportToExcel(exportData);
                break;
            case 'pdf':
                exportToPDF(exportData);
                break;
        }
        
        showToast(`Datos exportados exitosamente en formato ${format.toUpperCase()}`, 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error al exportar datos', 'error');
    }
}

function exportToCSV(data) {
    const csvContent = [
        'Código,Nombre,Grado,Puntos Totales,Actividades en Período,Última Actividad',
        ...data.map(student => {
            const historyEntries = Object.keys(student.historial).length;
            const lastActivityTimestamp = historyEntries > 0 ? 
                Object.keys(student.historial).sort((a, b) => parseInt(a) - parseInt(b)).pop() : // Get latest timestamp
                null;
            const lastActivity = lastActivityTimestamp ? new Date(parseInt(lastActivityTimestamp)) : null;
            const formattedLastActivity = lastActivity ? 
                lastActivity.toLocaleDateString('es-ES') : 
                'Sin actividad';
            
            return `${student.codigo},"${student.nombre}",${student.grado},${student.puntos},${historyEntries},"${formattedLastActivity}"`;
        })
    ].join('\n');
    
    downloadFile(csvContent, `ecosmart_export_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportToExcel(data) {
    // Simple Excel-compatible format (tab-separated values)
    const excelContent = [
        'Código\tNombre\tGrado\tPuntos Totales\tActividades en Período\tÚltima Actividad',
        ...data.map(student => {
            const historyEntries = Object.keys(student.historial).length;
            const lastActivityTimestamp = historyEntries > 0 ? 
                Object.keys(student.historial).sort((a, b) => parseInt(a) - parseInt(b)).pop() : 
                null;
            const lastActivity = lastActivityTimestamp ? new Date(parseInt(lastActivityTimestamp)) : null;
            const formattedLastActivity = lastActivity ? 
                lastActivity.toLocaleDateString('es-ES') : 
                'Sin actividad';
            
            return `${student.codigo}\t${student.nombre}\t${student.grado}\t${student.puntos}\t${historyEntries}\t${formattedLastActivity}`;
        })
    ].join('\n');
    
    downloadFile(excelContent, `ecosmart_export_${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel');
}

function exportToPDF(data) {
    // Create a simple HTML table for PDF conversion
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte EcoSmart</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #2563eb; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>Reporte EcoSmart - Sistema de Reciclaje</h1>
            <div class="summary">
                <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                <p><strong>Total de estudiantes:</strong> ${data.length}</p>
                <p><strong>Total de puntos:</strong> ${data.reduce((sum, s) => sum + s.puntos, 0)}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Grado</th>
                        <th>Puntos</th>
                        <th>Actividades</th>
                        <th>Última Actividad</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(student => {
                        const historyEntries = Object.keys(student.historial).length;
                        const lastActivityTimestamp = historyEntries > 0 ? 
                            Object.keys(student.historial).sort((a, b) => parseInt(a) - parseInt(b)).pop() : 
                            null;
                        const lastActivity = lastActivityTimestamp ? new Date(parseInt(lastActivityTimestamp)) : null;
                        const formattedLastActivity = lastActivity ? 
                            lastActivity.toLocaleDateString('es-ES') : 
                            'Sin actividad';
                        
                        return `
                            <tr>
                                <td>${student.codigo}</td>
                                <td>${student.nombre}</td>
                                <td>${student.grado}</td>
                                <td>${student.puntos}</td>
                                <td>${historyEntries}</td>
                                <td>${formattedLastActivity}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    // Create a new window and print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Student management functions
function showAddStudentModal() {
    document.getElementById('add-student-modal').classList.add('active');
    document.getElementById('new-student-code').value = '';
    document.getElementById('new-student-name').value = '';
    document.getElementById('new-student-grade').value = '';
    document.getElementById('custom-grade-input').style.display = 'none';
    document.getElementById('new-custom-grade').value = '';
    hideError('add-student-error');
    
    // Update grade options
    updateAllGradeSelectors();
}

function handleGradeChange(selectElement) {
    const customInputId = selectElement.id === 'new-student-grade' ? 
        'custom-grade-input' : 
        'edit-custom-grade-input';
    const customInput = document.getElementById(customInputId);
    
    if (selectElement.value === 'custom') {
        customInput.style.display = 'block';
        customInput.querySelector('input').focus();
    } else {
        customInput.style.display = 'none';
        customInput.querySelector('input').value = '';
    }
}

function closeAddStudentModal() {
    document.getElementById('add-student-modal').classList.remove('active');
}

async function addStudent() {
    const code = document.getElementById('new-student-code').value.trim();
    const name = document.getElementById('new-student-name').value.trim();
    let grade = document.getElementById('new-student-grade').value;
    const customGrade = document.getElementById('new-custom-grade').value.trim();
    
    if (!validateStudentCode(code)) {
        showError('add-student-error', 'El código debe tener exactamente 4 dígitos');
        return;
    }
    
    if (!name) {
        showError('add-student-error', 'El nombre es requerido');
        return;
    }
    
    if (grade === 'custom') {
        if (!customGrade) {
            showError('add-student-error', 'Por favor ingresa el grado personalizado');
            return;
        }
        grade = customGrade;
    } else if (!grade) {
        showError('add-student-error', 'El grado es requerido');
        return;
    }

    // Check if custom grade already exists in our gradesData
    if (grade === customGrade && gradesData.hasOwnProperty(grade)) {
        showError('add-student-error', 'Este grado personalizado ya existe.');
        return;
    }
    
    try {
        // Check if student code already exists
        const studentRef = ref(window.database, `students/${code}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists()) {
            showError('add-student-error', 'Ya existe un estudiante con este código');
            return;
        }
        
        // Add new student
        await set(studentRef, {
            nombre: sanitizeInput(name),
            grado: grade,
            puntos: 0,
            historial: {}
        });

        // If it's a new custom grade, add it to the grades collection
        if (!gradesData.hasOwnProperty(grade)) {
            await set(ref(window.database, `grades/${grade}`), true);
            await loadGrades(); // Reload grades to update all selectors
        }
        
        closeAddStudentModal();
        showToast('Estudiante agregado exitosamente', 'success');
        loadStudentsTable();
        
    } catch (error) {
        console.error('Error adding student:', error);
        showError('add-student-error', 'Error al agregar estudiante. Intenta nuevamente.');
    }
}

async function editStudent(code) {
    try {
        const studentRef = ref(window.database, `students/${code}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists()) {
            const student = snapshot.val();
            editingStudentCode = code;
            
            document.getElementById('edit-student-name').value = student.nombre;
            
            // Set the grade dropdown
            const editGradeSelect = document.getElementById('edit-student-grade');
            updateAllGradeSelectors(); // Ensure options are fresh
            if (getAvailableGrades().includes(student.grado)) {
                editGradeSelect.value = student.grado;
                document.getElementById('edit-custom-grade-input').style.display = 'none';
                document.getElementById('edit-custom-grade').value = '';
            } else {
                editGradeSelect.value = 'custom';
                document.getElementById('edit-custom-grade-input').style.display = 'block';
                document.getElementById('edit-custom-grade').value = student.grado;
            }

            document.getElementById('edit-student-modal').classList.add('active');
            hideError('edit-student-error');
        }
    } catch (error) {
        console.error('Error loading student for edit:', error);
        showToast('Error al cargar datos del estudiante', 'error');
    }
}

function closeEditStudentModal() {
    document.getElementById('edit-student-modal').classList.remove('active');
    editingStudentCode = null;
}

async function updateStudent() {
    if (!editingStudentCode) return;
    
    const name = document.getElementById('edit-student-name').value.trim();
    let grade = document.getElementById('edit-student-grade').value;
    const customGrade = document.getElementById('edit-custom-grade').value.trim();
    
    if (!name) {
        showError('edit-student-error', 'El nombre es requerido');
        return;
    }
    
    if (grade === 'custom') {
        if (!customGrade) {
            showError('edit-student-error', 'Por favor ingresa el grado personalizado');
            return;
        }
        grade = customGrade;
    } else if (!grade) {
        showError('edit-student-error', 'El grado es requerido');
        return;
    }

    // Check if custom grade already exists in our gradesData
    if (grade === customGrade && !gradesData.hasOwnProperty(grade)) {
        // This means the user typed a new custom grade during edit
        await set(ref(window.database, `grades/${grade}`), true);
        await loadGrades(); // Reload grades to update all selectors
    }
    
    try {
        const studentRef = ref(window.database, `students/${editingStudentCode}`);
        await update(studentRef, {
            nombre: sanitizeInput(name),
            grado: grade
        });
        
        closeEditStudentModal();
        showToast('Estudiante actualizado exitosamente', 'success');
        loadStudentsTable();
        
    } catch (error) {
        console.error('Error updating student:', error);
        showError('edit-student-error', 'Error al actualizar estudiante. Intenta nuevamente.');
    }
}

function confirmDeleteStudent(code, name) {
    showConfirmationModal(
        'Eliminar Estudiante',
        `¿Estás seguro de que deseas eliminar al estudiante <strong>${sanitizeHTML(name)}</strong> (Código: ${code})? Esta acción no se puede deshacer.`,
        () => deleteStudent(code)
    );
}

async function deleteStudent(code) {
    try {
        const studentRef = ref(window.database, `students/${code}`);
        await remove(studentRef);
        
        showToast('Estudiante eliminado exitosamente', 'success');
        loadStudentsTable();
        closeConfirmationModal(); // Close the confirmation modal
        
    } catch (error) {
        console.error('Error deleting student:', error);
        showToast('Error al eliminar estudiante', 'error');
    }
}

// Grade management functions (New)
function showAddGradeModal() {
    document.getElementById('add-grade-modal').classList.add('active');
    document.getElementById('new-grade-name').value = '';
    hideError('add-grade-error');
}

function closeAddGradeModal() {
    document.getElementById('add-grade-modal').classList.remove('active');
}

async function addGrade() {
    const gradeName = document.getElementById('new-grade-name').value.trim();
    
    if (!gradeName) {
        showError('add-grade-error', 'El nombre del grado es requerido.');
        return;
    }

    if (gradesData.hasOwnProperty(gradeName)) {
        showError('add-grade-error', 'Este grado ya existe.');
        return;
    }
    
    try {
        await set(ref(window.database, `grades/${gradeName}`), true);
        showToast(`Grado "${gradeName}" agregado exitosamente`, 'success');
        closeAddGradeModal();
        await loadGrades(); // Reload grades to update global state and all selectors
        loadGradesTable(); // Refresh the grades table in admin dashboard
    } catch (error) {
        console.error('Error adding grade:', error);
        showError('add-grade-error', 'Error al agregar el grado. Intenta nuevamente.');
    }
}

async function loadGradesTable() {
    try {
        const gradesRef = ref(window.database, 'grades');
        const snapshot = await get(gradesRef);
        
        const gradesTbody = document.getElementById('grades-tbody');
        gradesTbody.innerHTML = ''; // Clear existing rows
        
        if (snapshot.exists()) {
            const grades = snapshot.val();
            const gradesList = Object.keys(grades).sort(); // Sort alphabetically
            
            if (gradesList.length === 0) {
                gradesTbody.innerHTML = '<tr><td colspan="2" class="loading-row">No hay grados registrados</td></tr>';
                return;
            }

            gradesList.forEach(grade => {
                const row = gradesTbody.insertRow();
                row.innerHTML = `
                    <td><span class="grade-badge">${sanitizeHTML(grade)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button onclick="confirmDeleteGrade('${sanitizeHTML(grade)}')" class="btn btn-sm btn-danger" title="Eliminar Grado">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
            });
        } else {
            gradesTbody.innerHTML = '<tr><td colspan="2" class="loading-row">No hay grados registrados</td></tr>';
        }
    } catch (error) {
        console.error('Error loading grades table:', error);
        document.getElementById('grades-tbody').innerHTML = '<tr><td colspan="2" class="loading-row">Error al cargar grados</td></tr>';
    }
}

function confirmDeleteGrade(gradeName) {
    showConfirmationModal(
        'Eliminar Grado',
        `¿Estás seguro de que deseas eliminar el grado <strong>${sanitizeHTML(gradeName)}</strong>? Esto eliminará a <strong>TODOS</strong> los estudiantes asociados a este grado. Esta acción no se puede deshacer.`,
        () => deleteGrade(gradeName)
    );
}

async function deleteGrade(gradeName) {
    try {
        // 1. Remove the grade from the 'grades' collection
        await remove(ref(window.database, `grades/${gradeName}`));

        // 2. Find and remove all students associated with this grade
        const studentsRef = ref(window.database, 'students');
        const studentsSnapshot = await get(studentsRef);

        if (studentsSnapshot.exists()) {
            const students = studentsSnapshot.val();
            const studentsToDelete = Object.keys(students).filter(code => students[code].grado === gradeName);

            const deletePromises = studentsToDelete.map(code => 
                remove(ref(window.database, `students/${code}`))
            );
            await Promise.all(deletePromises);
        }
        
        showToast(`Grado "${gradeName}" y sus estudiantes eliminados exitosamente`, 'success');
        closeConfirmationModal(); // Close the confirmation modal
        await loadGrades(); // Reload grades to update global state and all selectors
        loadGradesTable(); // Refresh the grades table
        loadStudentsTable(); // Refresh students table as some might have been deleted
    } catch (error) {
        console.error('Error deleting grade:', error);
        showToast('Error al eliminar el grado', 'error');
    }
}

// New: Critical Data Management Functions
function confirmClearAllPoints() {
    showConfirmationModal(
        'Borrar Todos los Puntos',
        '¿Estás seguro de que deseas borrar los puntos de <strong>TODOS</strong> los estudiantes? Esta acción no se puede deshacer.',
        clearAllPoints
    );
}

async function clearAllPoints() {
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        if (snapshot.exists()) {
            const students = snapshot.val();
            const updates = {};
            for (const code in students) {
                updates[`students/${code}/puntos`] = 0;
                updates[`students/${code}/historial`] = {}; // Clear history as well
            }
            await update(ref(window.database), updates);
            showToast('Todos los puntos y historiales han sido borrados.', 'success');
            loadStudentsTable(); // Refresh student table
            loadAdminStatistics(); // Refresh stats
            loadMainMenuStats(); // Refresh main menu stats
        } else {
            showToast('No hay estudiantes para borrar puntos.', 'info');
        }
        closeConfirmationModal();
    } catch (error) {
        console.error('Error clearing all points:', error);
        showToast('Error al borrar todos los puntos.', 'error');
    }
}

function confirmDeleteAllStudents() {
    showConfirmationModal(
        'Eliminar Todos los Estudiantes',
        '¿Estás seguro de que deseas eliminar a <strong>TODOS</strong> los estudiantes? Esta acción no se puede deshacer.',
        deleteAllStudents
    );
}

async function deleteAllStudents() {
    try {
        await remove(ref(window.database, 'students'));
        showToast('Todos los estudiantes han sido eliminados.', 'success');
        loadStudentsTable(); // Refresh student table
        loadAdminStatistics(); // Refresh stats
        loadMainMenuStats(); // Refresh main menu stats
        closeConfirmationModal();
    } catch (error) {
        console.error('Error deleting all students:', error);
        showToast('Error al eliminar todos los estudiantes.', 'error');
    }
}

function confirmDeleteAllGrades() {
    showConfirmationModal(
        'Eliminar Todos los Grados',
        '¿Estás seguro de que deseas eliminar <strong>TODOS</strong> los grados y a <strong>TODOS</strong> los estudiantes asociados a ellos? Esta acción no se puede deshacer.',
        deleteAllGrades
    );
}

async function deleteAllGrades() {
    try {
        await remove(ref(window.database, 'grades'));
        await remove(ref(window.database, 'students')); // Also delete all students
        showToast('Todos los grados y estudiantes han sido eliminados.', 'success');
        await loadGrades(); // Re-initialize grades
        loadGradesTable();
        loadStudentsTable();
        loadAdminStatistics();
        loadMainMenuStats();
        closeConfirmationModal();
    } catch (error) {
        console.error('Error deleting all grades:', error);
        showToast('Error al eliminar todos los grados.', 'error');
    }
}

// New: Admin Credentials Management
function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = field.nextElementSibling.querySelector('i'); // Assuming icon is next sibling
    if (field.type === 'password') {
        field.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        field.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function checkPasswordStrength() {
    const password = document.getElementById('new-admin-password').value;
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');

    let strength = 0;
    if (password.length > 5) strength++;
    if (password.length > 9) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++; // Special characters

    let strengthPercentage = (strength / 6) * 100;
    let strengthColor = 'red';
    let strengthLabel = 'Débil';

    if (strengthPercentage > 30) {
        strengthColor = 'orange';
        strengthLabel = 'Moderada';
    }
    if (strengthPercentage > 60) {
        strengthColor = 'yellowgreen';
        strengthLabel = 'Fuerte';
    }
    if (strengthPercentage === 100) {
        strengthLabel = 'Muy Fuerte';
    }

    strengthBar.style.width = `${strengthPercentage}%`;
    strengthBar.style.backgroundColor = strengthColor;
    strengthText.textContent = strengthLabel;
}

async function changeAdminCredentials() {
    const newUsername = document.getElementById('new-admin-username').value.trim();
    const newPassword = document.getElementById('new-admin-password').value.trim();
    const confirmPassword = document.getElementById('confirm-admin-password').value.trim();
    const errorElement = document.getElementById('admin-credentials-error');

    hideError('admin-credentials-error');

    if (!newUsername || !newPassword || !confirmPassword) {
        showError('admin-credentials-error', 'Todos los campos son requeridos.');
        return;
    }

    if (newPassword !== confirmPassword) {
        showError('admin-credentials-error', 'Las contraseñas no coinciden.');
        return;
    }

    // Basic password strength check (can be expanded)
    if (newPassword.length < 6) {
        showError('admin-credentials-error', 'La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    try {
        const adminRef = ref(window.database, 'admins/admin1');
        await update(adminRef, {
            usuario: sanitizeInput(newUsername),
            contraseña: newPassword
        });
        showToast('Credenciales de administrador actualizadas exitosamente.', 'success');
        // Clear fields after successful update
        document.getElementById('new-admin-username').value = '';
        document.getElementById('new-admin-password').value = '';
        document.getElementById('confirm-admin-password').value = '';
        checkPasswordStrength(); // Reset strength meter
    } catch (error) {
        console.error('Error changing admin credentials:', error);
        showError('admin-credentials-error', 'Error al cambiar las credenciales. Intenta nuevamente.');
    }
}


// Custom Confirmation Modal
let confirmCallback = null;

function showConfirmationModal(title, message, callback) {
    document.getElementById('confirmation-title').innerHTML = sanitizeHTML(title);
    document.getElementById('confirmation-message').innerHTML = message;
    confirmCallback = callback;
    document.getElementById('confirm-action-btn').onclick = () => {
        if (confirmCallback) {
            confirmCallback();
        }
    };
    document.getElementById('confirmation-modal').classList.add('active');
}

function closeConfirmationModal() {
    document.getElementById('confirmation-modal').classList.remove('active');
    confirmCallback = null; // Clear the callback
}

function cancelConfirmation() {
    closeConfirmationModal();
}

// Settings functions
async function saveSettings() {
    const pointsPerBottle = parseInt(document.getElementById('points-per-bottle').value);
    
    if (!pointsPerBottle || pointsPerBottle < 1) {
        showToast('Los puntos por botella deben ser un número mayor a 0', 'error');
        return;
    }
    
    try {
        const configRef = ref(window.database, 'config/puntosPorBotella');
        await set(configRef, pointsPerBottle);
        
        showToast('Configuración guardada exitosamente', 'success');
    }
    catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error al guardar configuración', 'error');
    }
}

// Statistics functions
async function loadStatistics() {
    try {
        const studentsRef = ref(window.database, 'students');
        const snapshot = await get(studentsRef);
        
        if (snapshot.exists()) {
            const students = snapshot.val();
            const studentsList = Object.values(students);
            
            const totalBottles = studentsList.reduce((sum, student) => sum + (student.puntos || 0), 0);
            const activeStudents = studentsList.filter(student => (student.puntos || 0) > 0).length;
            
            statisticsData = {
                totalBottles: totalBottles,
                activeStudents: activeStudents,
                totalStudents: studentsList.length
            };
        } else {
            statisticsData = {
                totalBottles: 0,
                activeStudents: 0,
                totalStudents: 0
            };
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        statisticsData = {
            totalBottles: 0,
            activeStudents: 0,
            totalStudents: 0
        };
    }
}

function loadMainMenuStats() {
    document.getElementById('total-bottles').textContent = statisticsData.totalBottles || 0;
    document.getElementById('active-students').textContent = statisticsData.activeStudents || 0;
}

// Sample data initialization
async function initializeSampleData() {
    try {
        const studentsRef = ref(window.database, 'students');
        const studentsSnapshot = await get(studentsRef);
        const gradesRef = ref(window.database, 'grades');
        const gradesSnapshot = await get(gradesRef);
        const adminRef = ref(window.database, 'admins/admin1');
        const adminSnapshot = await get(adminRef);
        const configRef = ref(window.database, 'config');
        const configSnapshot = await get(configRef);
        
        if (!studentsSnapshot.exists() && !gradesSnapshot.exists() && !adminSnapshot.exists() && !configSnapshot.exists()) {
            console.log('Initializing sample data...');
            
            // Sample grades data
            const sampleGrades = {
                '6-1': true, '6-2': true, '6-3': true, 
                '7-1': true, '7-2': true, '7-3': true,
                'Preescolar': true, '8-1': true // Example custom grades
            };
            for (const gradeName in sampleGrades) {
                await set(ref(window.database, `grades/${gradeName}`), true);
            }
            
            // Sample students data
            const sampleStudents = {
                '1001': { nombre: 'Ana García López', grado: '6-1', puntos: 15, historial: { [Date.now() - 86400000 * 2]: 5, [Date.now() - 86400000]: 10 } },
                '1002': { nombre: 'Carlos Rodríguez Pérez', grado: '6-1', puntos: 12, historial: { [Date.now() - 86400000 * 3]: 7, [Date.now() - 86400000 * 1.5]: 5 } },
                '1003': { nombre: 'María Fernández Silva', grado: '6-2', puntos: 18, historial: { [Date.now() - 86400000 * 4]: 8, [Date.now() - 86400000 * 2.5]: 10 } },
                '1004': { nombre: 'Diego Martínez Cruz', grado: '6-2', puntos: 28, historial: { [Date.now() - 86400000 * 1]: 8, [Date.now() - 86400000 * 0.5]: 20 } },
                '1005': { nombre: 'Sofía Hernández Ruiz', grado: '6-3', puntos: 52, historial: { [Date.now() - 86400000 * 5]: 12, [Date.now() - 86400000 * 0.5]: 40 } },
                '2001': { nombre: 'Alejandro Torres Vega', grado: '7-1', puntos: 14, historial: { [Date.now() - 86400000 * 2]: 14 } },
                '2002': { nombre: 'Isabella Morales Castro', grado: '7-1', puntos: 19, historial: { [Date.now() - 86400000 * 3]: 9, [Date.now() - 86400000 * 1]: 10 } },
                '2003': { nombre: 'Sebastián Jiménez Ortiz', grado: '7-2', puntos: 11, historial: { [Date.now() - 86400000 * 4]: 6, [Date.now() - 86400000 * 2]: 5 } },
                '2004': { nombre: 'Valentina Ramírez Flores', grado: '7-2', puntos: 16, historial: { [Date.now() - 86400000 * 1]: 16 } },
                '2005': { nombre: 'Mateo Vargas Mendoza', grado: '7-3', puntos: 9, historial: { [Date.now() - 86400000 * 0.5]: 9 } },
                '3001': { nombre: 'Laura Pérez', grado: 'Preescolar', puntos: 5, historial: { [Date.now() - 86400000 * 1]: 5 } },
                '3002': { nombre: 'Juan David', grado: '8-1', puntos: 25, historial: { [Date.now() - 86400000 * 2]: 15, [Date.now() - 86400000 * 0.5]: 10 } }
            };
            
            // Add sample students
            for (const [code, data] of Object.entries(sampleStudents)) {
                const studentRef = ref(window.database, `students/${code}`);
                await set(studentRef, data);
            }
            
            // Add admin user
            await set(adminRef, {
                usuario: 'admin',
                contraseña: 'root'
            });
            
            // Add configuration
            await set(configRef, {
                puntosPorBotella: 1
            });
            
            console.log('Sample data initialized successfully');
            await loadGrades(); // Ensure grades are loaded after sample data init
        }
    } catch (error) {
        console.error('Error initializing sample data:', error);
    }
}

// Utility functions
function validateStudentCode(code) {
    return /^\d{4}$/.test(code);
}

function sanitizeInput(input) {
    return input.replace(/[<>\"'&]/g, '');
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.innerHTML = message; // Use innerHTML to allow strong tags etc.
    errorElement.classList.add('show');
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.classList.remove('show');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Make functions globally available
window.showMainMenu = showMainMenu;
window.showStudentLogin = showStudentLogin;
window.showGuestAccess = showGuestAccess;
window.showAdminLogin = showAdminLogin;
window.loginStudent = loginStudent;
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.showAdminTab = showAdminTab;
window.filterByGrade = filterByGrade;
window.showAddStudentModal = showAddStudentModal;
window.closeAddStudentModal = closeAddStudentModal;
window.addStudent = addStudent;
window.editStudent = editStudent;
window.closeEditStudentModal = closeEditStudentModal;
window.updateStudent = updateStudent;
window.confirmDeleteStudent = confirmDeleteStudent; // Expose confirmation wrapper
window.saveSettings = saveSettings;
window.exportData = exportData;
window.handleGradeChange = handleGradeChange;
window.showAddGradeModal = showAddGradeModal; // New
window.closeAddGradeModal = closeAddGradeModal; // New
window.addGrade = addGrade; // New
window.confirmDeleteGrade = confirmDeleteGrade; // New
window.showStudentStatsModal = showStudentStatsModal; // New
window.closeStudentStatsModal = closeStudentStatsModal; // New
window.cancelConfirmation = cancelConfirmation; // For the custom confirmation modal
window.increaseStudentPoints = showAddPointsModal; // Now calls the modal
window.loadGradesTable = loadGradesTable; // Added missing global export

// New global exports for admin settings
window.confirmClearAllPoints = confirmClearAllPoints;
window.confirmDeleteAllStudents = confirmDeleteAllStudents;
window.confirmDeleteAllGrades = confirmDeleteAllGrades;
window.togglePasswordVisibility = togglePasswordVisibility;
window.checkPasswordStrength = checkPasswordStrength;
window.changeAdminCredentials = changeAdminCredentials;

// New global exports for add points modal
window.showAddPointsModal = showAddPointsModal;
window.closeAddPointsModal = closeAddPointsModal;
window.confirmIncreaseStudentPoints = confirmIncreaseStudentPoints;

// New global exports for view grade students modal
window.viewGradeStudents = viewGradeStudents;
window.closeViewGradeStudentsModal = closeViewGradeStudentsModal;
