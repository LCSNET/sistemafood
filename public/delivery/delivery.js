document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Elementos da UI
    const loginView = document.getElementById('login-view');
    const trackingView = document.getElementById('tracking-view');
    const loginForm = document.getElementById('login-form');
    const deliveryIdInput = document.getElementById('delivery-id-input');
    const stopTrackingBtn = document.getElementById('stop-tracking-btn');
    const deliveryIdDisplay = document.getElementById('delivery-id-display');
    const trackingStatusDiv = document.getElementById('tracking-status');
    
    let watchId = null;

    // Registra o Service Worker para rastreamento em segundo plano
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/delivery/service-worker.js')
            .then(reg => console.log('Service Worker registrado!', reg))
            .catch(err => console.error('Falha ao registrar Service Worker:', err));
    }

    // --- Funções de Controle de Estado e UI ---

    const showLoginView = () => {
        trackingView.classList.add('hidden');
        loginView.classList.remove('hidden');
    };

    const showTrackingView = (deliveryId) => {
        loginView.classList.add('hidden');
        trackingView.classList.remove('hidden');
        deliveryIdDisplay.textContent = `#${deliveryId}`;
    };

    const startTracking = (deliveryId) => {
        // Salva o estado no localStorage
        localStorage.setItem('deliveryId', deliveryId);
        localStorage.setItem('isTracking', 'true');

        showTrackingView(deliveryId);

        // Opções para alta precisão de geolocalização
        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        // Envia a localização continuamente enquanto a aba está aberta
        watchId = navigator.geolocation.watchPosition(
            position => {
                const { latitude, longitude } = position.coords;
                socket.emit('locationUpdate', { deliveryId, lat: latitude, lng: longitude });
                trackingStatusDiv.classList.add('animate-pulse'); // Sinaliza envio
                setTimeout(() => trackingStatusDiv.classList.remove('animate-pulse'), 1000);
            },
            err => console.error("Erro de Geolocalização:", err),
            geoOptions
        );
        
        // Envia uma mensagem para o Service Worker iniciar o rastreamento em segundo plano
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                action: 'start',
                deliveryId: deliveryId
            });
        }
    };

    const stopTracking = () => {
        // Limpa o estado do localStorage
        localStorage.removeItem('deliveryId');
        localStorage.removeItem('isTracking');

        // Para o rastreamento em primeiro plano
        if (watchId) navigator.geolocation.clearWatch(watchId);
        watchId = null;

        // Para o rastreamento em segundo plano
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'stop' });
        }
        
        showLoginView();
        deliveryIdInput.value = '';
    };

    // --- Event Listeners ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const deliveryId = deliveryIdInput.value;
        if (deliveryId) {
            startTracking(deliveryId);
        }
    });

    stopTrackingBtn.addEventListener('click', () => {
        if (confirm('Você tem certeza que deseja finalizar a entrega e parar o rastreamento?')) {
            stopTracking();
        }
    });

    // --- Verificação de Estado Inicial ---

    function checkInitialState() {
        const savedId = localStorage.getItem('deliveryId');
        const isTracking = localStorage.getItem('isTracking');

        if (savedId && isTracking === 'true') {
            // Se já estava rastreando, reinicia o processo automaticamente
            startTracking(savedId);
        } else {
            showLoginView();
        }
    }

    checkInitialState();
});