

// Configuración
const CONFIG = {
    MAX_ATTEMPTS: 3,
    MIN_PASSWORD_LENGTH: 8,
    LOCK_TIME: 50000, // 50 segundos
    REDIRECT_DELAY: 1000, // 1 segundo para redirección
    LOADING_DELAY: 1500 // 1.5 segundos para simular carga
};

// Elementos del DOM
const DOM = {
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    showRegister: document.getElementById('showRegister'),
    backToLogin: document.getElementById('backToLogin'),
    passwordInput: document.getElementById('password'),
    newPasswordInput: document.getElementById('newPassword'),
    confirmPasswordInput: document.getElementById('confirmPassword'),
    togglePassword: document.getElementById('togglePassword'),
    toggleNewPassword: document.getElementById('toggleNewPassword'),
    toggleConfirmPassword: document.getElementById('toggleConfirmPassword'),
    registerBtn: document.getElementById('registerBtn'),
    loadingModal: document.getElementById('loadingModal'),
    notification: document.getElementById('notification'),
    blockTimer: document.getElementById('blockTimer'),
    timerText: document.getElementById('timerText')
};

// Estado
const state = {
    attempts: 0,
    registeredPassword: localStorage.getItem('userPassword') || null,
    isBlocked: false,
    timerInterval: null
};

// Funciones
function showLoading() {
    DOM.loadingModal.style.display = 'flex';
}

function hideLoading() {
    DOM.loadingModal.style.display = 'none';
}

function showNotification(message, type = 'success', duration = 3000) {
    const notification = DOM.notification;
    const icon = notification.querySelector('.notification-icon');
    const msg = notification.querySelector('.notification-message');
    
    notification.className = 'notification ' + type;
    icon.className = 'notification-icon';
    
    switch(type) {
        case 'success':
            icon.innerHTML = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            break;
    }
    
    msg.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => notification.classList.remove('show'), duration);
}

function toggleForm(showRegister) {
    const currentForm = showRegister ? DOM.loginForm : DOM.registerForm;
    const nextForm = showRegister ? DOM.registerForm : DOM.loginForm;
    
    currentForm.classList.remove('active');
    setTimeout(() => nextForm.classList.add('active'), 400);
}

function togglePasswordVisibility(input, toggle) {
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    const icon = toggle.querySelector('i');
    icon.className = type === 'password' ? 'far fa-eye' : 'far fa-eye-slash';
}

function validateRegisterForm() {
    const password = DOM.newPasswordInput.value;
    const confirmPassword = DOM.confirmPasswordInput.value;
    
    const isValid = password.length >= CONFIG.MIN_PASSWORD_LENGTH && 
                   password === confirmPassword;
    
    DOM.registerBtn.disabled = !isValid;
    return isValid;
}

function startBlockTimer() {
    let timeLeft = CONFIG.LOCK_TIME / 1000;
    DOM.blockTimer.classList.add('show');
    
    state.timerInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        DOM.timerText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(state.timerInterval);
            DOM.blockTimer.classList.remove('show');
            state.isBlocked = false;
            showNotification('Ya puedes intentar nuevamente', 'success');
        }
    }, 1000);
}

function updateAttemptsCounter() {
    let counter = DOM.loginForm.querySelector('.attempts-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'attempts-counter';
        DOM.loginForm.appendChild(counter);
    }
    const remaining = CONFIG.MAX_ATTEMPTS - state.attempts;
    counter.textContent = `Intentos restantes: ${remaining}`;
    counter.style.color = remaining === 1 ? 'red' : 'var(--error-color)';
}

function handleSuccessfulLogin() {
    showLoading();
    setTimeout(() => {
        hideLoading();
        showNotification('Acceso concedido', 'success');
        setTimeout(() => {
            window.location.href = "cuentas-seguras/cuentas.html";
        }, CONFIG.REDIRECT_DELAY);
    }, CONFIG.LOADING_DELAY);
    state.attempts = 0;
    updateAttemptsCounter();
}

function handleFailedLogin() {
    state.attempts++;
    updateAttemptsCounter();
    
    if (state.attempts >= CONFIG.MAX_ATTEMPTS) {
        state.isBlocked = true;
        showNotification(`Acceso bloqueado. Espere ${CONFIG.LOCK_TIME/1000} segundos.`, 'error');
        DOM.loginForm.querySelector('button').disabled = true;
        startBlockTimer();
        
        setTimeout(() => {
            DOM.loginForm.querySelector('button').disabled = false;
            state.attempts = 0;
            state.isBlocked = false;
            updateAttemptsCounter();
        }, CONFIG.LOCK_TIME);
    } else {
        showNotification(`Contraseña incorrecta. ${CONFIG.MAX_ATTEMPTS - state.attempts} intento(s) restante(s)`, 'error');
        DOM.passwordInput.value = '';
        DOM.passwordInput.focus();
    }
}

// Event Listeners
function setupEventListeners() {
    DOM.showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForm(true);
    });

    DOM.backToLogin.addEventListener('click', () => {
        toggleForm(false);
    });

    DOM.togglePassword.addEventListener('click', () => {
        togglePasswordVisibility(DOM.passwordInput, DOM.togglePassword);
    });

    DOM.toggleNewPassword.addEventListener('click', () => {
        togglePasswordVisibility(DOM.newPasswordInput, DOM.toggleNewPassword);
    });

    DOM.toggleConfirmPassword.addEventListener('click', () => {
        togglePasswordVisibility(DOM.confirmPasswordInput, DOM.toggleConfirmPassword);
    });

    DOM.newPasswordInput.addEventListener('input', () => {
        validateRegisterForm();
    });

    DOM.confirmPasswordInput.addEventListener('input', () => {
        validateRegisterForm();
    });

    DOM.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = DOM.passwordInput.value;
        
        if (!state.registeredPassword) {
            showNotification('Primero debes registrar una contraseña', 'warning');
            toggleForm(true);
            return;
        }

        if (state.isBlocked) {
            showNotification('Espera a que termine el tiempo de bloqueo', 'error');
            return;
        }

        if (password === state.registeredPassword) {
            handleSuccessfulLogin();
        } else {
            handleFailedLogin();
        }
    });

    DOM.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!validateRegisterForm()) return;
        
        const newPassword = DOM.newPasswordInput.value;
        
        showLoading();
        
        setTimeout(() => {
            state.registeredPassword = newPassword;
            localStorage.setItem('userPassword', newPassword);
            
            hideLoading();
            showNotification('Contraseña registrada con éxito', 'success');
            
            toggleForm(false);
            DOM.registerForm.reset();
            DOM.registerBtn.disabled = true;
            updateAttemptsCounter();
        }, 1000);
    });
}

// Inicialización
function init() {
    if (!state.registeredPassword) {
        DOM.registerForm.classList.add('active');
    } else {
        DOM.loginForm.classList.add('active');
        updateAttemptsCounter();
    }
    setupEventListeners();
}

// Iniciar la aplicación
init();