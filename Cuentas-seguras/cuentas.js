

document.addEventListener("DOMContentLoaded", function() {
    // ========== VARIABLES GLOBALES ==========
    const addCredentialForm = document.getElementById("addCredentialForm");
    const credentialsList = document.getElementById("credentialsList");
    const searchInput = document.getElementById("searchInput");
    const toggleThemeBtn = document.getElementById("toggleTheme");
    const exportBtn = document.getElementById("exportBtn");
    const themeSelector = document.getElementById("themeSelector");
    const passwordInput = document.getElementById("password");
    const strengthMeter = document.getElementById("strengthMeter");
    const strengthIndicator = document.getElementById("strengthIndicator");
    const confirmationModal = document.getElementById("confirmationModal");
    const loadingModal = document.getElementById("loadingModal");
    const modalMessage = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("confirmBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const closeModal = document.querySelector(".close-modal");
    
    let currentIndexToDelete = null;
    let currentEditingIndex = null;

    // ========== FUNCIONES DE UTILIDAD ==========
    function getCredentials() {
        const credentials = localStorage.getItem("credentials");
        return credentials ? JSON.parse(credentials) : [];
    }

    // ========== FUNCIONES DE CATEGORÍAS MEJORADAS ==========
    function getCategoryInfo(category) {
        const categories = {
            "redes": {
                label: "Red Social",
                icon: "📱",
                color: "#3b5998"
            },
            "bancos": {
                label: "Banco",
                icon: "🏦", 
                color: "#2ecc71"
            },
            "trabajo": {
                label: "Trabajo",
                icon: "💼",
                color: "#3498db"
            },
            "personal": {
                label: "Personal",
                icon: "👤",
                color: "#9b59b6"
            }
        };
        return categories[category] || {
            label: "General",
            icon: "🔒",
            color: "#95a5a6"
        };
    }

    function populateCategorySelect() {
        const categorySelect = document.getElementById("category");
        const categories = {
            "": "🔒 Sin categoría",
            "redes": "📱 Redes Sociales",
            "bancos": "🏦 Bancos",
            "trabajo": "💼 Trabajo",
            "personal": "👤 Personal"
        };
        
        categorySelect.innerHTML = '';
        for (const [value, label] of Object.entries(categories)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            categorySelect.appendChild(option);
        }
    }

    // ========== EVENT LISTENERS ==========
    addCredentialForm.addEventListener("submit", handleFormSubmit);
    if (searchInput) searchInput.addEventListener("input", filterCredentials);
    if (toggleThemeBtn) toggleThemeBtn.addEventListener("click", toggleTheme);
    if (exportBtn) exportBtn.addEventListener("click", exportToJSON);
    if (themeSelector) themeSelector.addEventListener("change", changeTheme);
    if (passwordInput) passwordInput.addEventListener("input", updatePasswordStrength);
    confirmBtn.addEventListener("click", confirmDelete);
    cancelBtn.addEventListener("click", hideConfirmationModal);
    closeModal.addEventListener("click", hideConfirmationModal);
    confirmationModal.addEventListener("click", function(e) {
        if (e.target === confirmationModal) hideConfirmationModal();
    });
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && confirmationModal.classList.contains("show")) {
            hideConfirmationModal();
        }
    });

    // ========== FUNCIONES PRINCIPALES ==========
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const appName = document.getElementById("appName").value.trim();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const category = document.getElementById("category").value;
    
        if (!validateInputs(appName, username, password)) {
            return;
        }
    
        try {
            showLoading();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const encryptedPassword = encrypt(password);
            
            if (currentEditingIndex !== null) {
                updateCredential(currentEditingIndex, {
                    appName,
                    username,
                    password: encryptedPassword,
                    category
                });
                showAlert("✏️ Credencial actualizada", "success");
                currentEditingIndex = null;
            } else {
                saveCredential({
                    appName,
                    username,
                    password: encryptedPassword,
                    category,
                    createdAt: new Date().toISOString()
                });
                showAlert("✅ Credencial guardada", "success");
            }
            
            addCredentialForm.reset();
            strengthMeter.value = 0;
            strengthIndicator.textContent = "Seguridad: Muy débil";
            loadCredentials();
            
        } catch (error) {
            showAlert("❌ Error al procesar: " + error.message, "error");
        } finally {
            hideLoading();
        }
    }

    function validateInputs(appName, username, password) {
        if (!appName || !username || !password) {
            showAlert("⚠️ Todos los campos son obligatorios", "error");
            return false;
        }
        
        if (password.length < 6) {
            showAlert("🔒 La contraseña debe tener al menos 6 caracteres", "error");
            return false;
        }
        
        return true;
    }

    function saveCredential(credential) {
        const credentials = getCredentials();
        credentials.push(credential);
        localStorage.setItem("credentials", JSON.stringify(credentials));
        updateCounter();
    }

    function updateCredential(index, credential) {
        const credentials = getCredentials();
        if (index >= 0 && index < credentials.length) {
            credentials[index] = credential;
            localStorage.setItem("credentials", JSON.stringify(credentials));
            updateCounter();
        }
    }

    function loadCredentials() {
        const credentials = getCredentials();
        credentialsList.innerHTML = "";

        if (credentials.length === 0) {
            credentialsList.innerHTML = `
                <div class="empty-state">
                    <p>No hay credenciales guardadas</p>
                </div>
            `;
            updateCounter();
            return;
        }

        credentials.forEach((cred, index) => {
            const credElement = createCredentialElement(cred, index);
            credentialsList.appendChild(credElement);
        });
        
        updateCounter();
    }

    function createCredentialElement(cred, index) {
        const credDiv = document.createElement("div");
        credDiv.className = "credential-item";
        credDiv.dataset.appName = cred.appName.toLowerCase();
        credDiv.dataset.category = cred.category || "";
        credDiv.dataset.index = index;
        
        const decryptedPassword = decrypt(cred.password);
        const categoryInfo = getCategoryInfo(cred.category);
        
        credDiv.innerHTML = `
            <div class="credential-header">
                <div class="credential-title-container">
                    <span class="app-icon">${categoryInfo.icon}</span>
                    <h3>${cred.appName}</h3>
                </div>
                <div class="credential-meta">
                    <span class="credential-category" style="background-color: ${categoryInfo.color}">
                        ${categoryInfo.icon} ${categoryInfo.label}
                    </span>
                    <span class="credential-date">${formatDate(cred.createdAt)}</span>
                </div>
            </div>
            <div class="credential-body">
                <p><span class="label">👤 Usuario:</span> ${cred.username}</p>
                <div class="password-container">
                    <span class="label">🔒 Contraseña:</span>
                    <div class="password-field-container">
                        <span class="password-field" style="display: none;">${decryptedPassword}</span>
                        <button class="show-password-btn" data-index="${index}">👁️ Mostrar</button>
                    </div>
                </div>
            </div>
            <div class="credential-actions">
                <button class="copy-btn" data-password="${decryptedPassword}">📋 Copiar</button>
                <button class="edit-btn" data-index="${index}">✏️ Editar</button>
                <button class="delete-btn" data-index="${index}">🗑️ Eliminar</button>
            </div>
        `;

        credDiv.querySelector(".show-password-btn").addEventListener("click", togglePasswordVisibility);
        credDiv.querySelector(".copy-btn").addEventListener("click", copyPassword);
        credDiv.querySelector(".edit-btn").addEventListener("click", setupEditHandler);
        credDiv.querySelector(".delete-btn").addEventListener("click", showDeleteConfirmation);

        return credDiv;
    }

    // ========== FUNCIONES SECUNDARIAS ==========
    function togglePasswordVisibility(e) {
        const btn = e.target;
        const passwordField = btn.closest(".password-field-container").querySelector(".password-field");
        
        if (passwordField.style.display === "none") {
            passwordField.style.display = "inline";
            btn.textContent = "👁️ Ocultar";
        } else {
            passwordField.style.display = "none";
            btn.textContent = "👁️ Mostrar";
        }
    }

    function copyPassword(e) {
        const password = e.target.dataset.password;
        navigator.clipboard.writeText(password)
            .then(() => showAlert("🔑 Contraseña copiada al portapapeles", "success"))
            .catch(err => showAlert("❌ Error al copiar: " + err, "error"));
    }

    function setupEditHandler(e) {
        const index = parseInt(e.target.dataset.index);
        const credentials = getCredentials();
        
        if (index >= 0 && index < credentials.length) {
            const cred = credentials[index];
            document.getElementById("appName").value = cred.appName;
            document.getElementById("username").value = cred.username;
            document.getElementById("password").value = decrypt(cred.password);
            document.getElementById("category").value = cred.category || "";
            
            currentEditingIndex = index;
            
            addCredentialForm.scrollIntoView({ behavior: "smooth" });
            document.getElementById("appName").focus();
            
            showAlert("✏️ Modo edición activado", "warning");
        }
    }

    function showDeleteConfirmation(e) {
        const index = parseInt(e.target.dataset.index);
        const credentials = getCredentials();
        
        if (index >= 0 && index < credentials.length) {
            currentIndexToDelete = index;
            const appName = credentials[index].appName;
            modalMessage.textContent = `¿Eliminar credencial de "${appName}"?`;
            confirmationModal.classList.add("show");
            document.body.style.overflow = "hidden";
        }
    }

    async function confirmDelete() {
        if (currentIndexToDelete === null) return;
    
        try {
            showLoading();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const credentials = getCredentials();
            if (currentIndexToDelete >= 0 && currentIndexToDelete < credentials.length) {
                const credElement = document.querySelector(`.credential-item[data-index="${currentIndexToDelete}"]`);
                
                if (credElement) {
                    credElement.classList.add("fade-out");
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    credentials.splice(currentIndexToDelete, 1);
                    localStorage.setItem("credentials", JSON.stringify(credentials));
                    loadCredentials();
                    showAlert("🗑️ Credencial eliminada", "warning");
                }
            }
        } catch (error) {
            showAlert("❌ Error al eliminar: " + error.message, "error");
        } finally {
            hideLoading();
            hideConfirmationModal();
        }
    }

    function hideConfirmationModal() {
        confirmationModal.classList.remove("show");
        document.body.style.overflow = "auto";
        currentIndexToDelete = null;
    }

    function showLoading() {
        loadingModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function hideLoading() {
        loadingModal.classList.remove("show");
        document.body.style.overflow = "auto";
    }

    function filterCredentials() {
        const searchTerm = searchInput.value.toLowerCase();
        const allCreds = document.querySelectorAll(".credential-item");

        allCreds.forEach(cred => {
            const appName = cred.dataset.appName;
            const username = cred.querySelector(".credential-body p:nth-child(1)").textContent.toLowerCase();
            const matches = appName.includes(searchTerm) || username.includes(searchTerm);
            cred.style.display = matches ? "block" : "none";
        });
    }

    function updatePasswordStrength() {
        const password = passwordInput.value;
        const strength = checkPasswordStrength(password);
        
        strengthMeter.value = strength.score;
        strengthMeter.dataset.strength = strength.score;
        strengthIndicator.textContent = `Seguridad: ${strength.text}`;
    }

    function checkPasswordStrength(password) {
        let score = 0;
        const strength = {
            0: { text: "Muy débil", color: "#ff4d4d" },
            1: { text: "Débil", color: "#ffa500" },
            2: { text: "Moderada", color: "#ffcc00" },
            3: { text: "Fuerte", color: "#4CAF50" },
            4: { text: "Muy fuerte", color: "#2ecc71" }
        };
        
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        return {
            score,
            ...strength[Math.min(score, 4)]
        };
    }

    function toggleTheme() {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
        toggleThemeBtn.textContent = document.body.classList.contains("dark-mode") 
            ? "🌞 Modo Claro" 
            : "🌙 Modo Oscuro";
    }

    function changeTheme(e) {
        document.body.className = e.target.value;
        localStorage.setItem("theme", e.target.value);
    }

    function exportToJSON() {
        const credentials = getCredentials();
        const dataStr = JSON.stringify(credentials, null, 2);
        const dataUri = "data:application/json;charset=utf-8,"+ encodeURIComponent(dataStr);
        const exportName = `credenciales_${new Date().toISOString().slice(0, 10)}.json`;
        
        const linkElement = document.createElement("a");
        linkElement.setAttribute("href", dataUri);
        linkElement.setAttribute("download", exportName);
        linkElement.click();
        
        showAlert("📤 Exportación completada", "success");
    }

    function updateCounter() {
        const count = getCredentials().length;
        document.getElementById("credentialCount").textContent = 
            `${count} ${count === 1 ? 'credencial' : 'credenciales'} guardada${count !== 1 ? 's' : ''}`;
    }

    function encrypt(text) {
        return CryptoJS.AES.encrypt(text, "clave-segura-123").toString();
    }

    function decrypt(ciphertext) {
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, "clave-segura-123");
            return bytes.toString(CryptoJS.enc.Utf8) || ciphertext;
        } catch (e) {
            return ciphertext;
        }
    }

    function formatDate(isoString) {
        if (!isoString) return "";
        const date = new Date(isoString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement("div");
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <span class="alert-icon">${getAlertIcon(type)}</span>
            ${message}
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.classList.add("fade-out");
            setTimeout(() => alertDiv.remove(), 500);
        }, 3000);
    }

    function getAlertIcon(type) {
        const icons = {
            "success": "✅",
            "error": "❌",
            "warning": "⚠️"
        };
        return icons[type] || "";
    }

    // ========== INICIALIZACIÓN ==========
    function init() {
        if (localStorage.getItem("darkMode") === "true") {
            document.body.classList.add("dark-mode");
            if (toggleThemeBtn) toggleThemeBtn.textContent = "🌞 Modo Claro";
        }
        
        const savedTheme = localStorage.getItem("theme") || "default";
        if (themeSelector) {
            themeSelector.value = savedTheme;
            document.body.classList.add(savedTheme);
        }
        
        populateCategorySelect();
        loadCredentials();
    }

    init();
});