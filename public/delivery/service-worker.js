let intervalId;
let deliveryId;

// Escuta mensagens da página principal (delivery.js)
self.addEventListener('message', event => {
    if (event.data.action === 'start') {
        deliveryId = event.data.deliveryId;
        console.log(`Service Worker: Iniciando rastreamento para o ID ${deliveryId}.`);
        
        // Limpa qualquer intervalo anterior para evitar múltiplos rastreamentos
        if (intervalId) clearInterval(intervalId);
        
        // Inicia o envio de localização a cada 20 segundos
        intervalId = setInterval(() => {
            if (!deliveryId) {
                // Se não houver ID, para o rastreamento
                clearInterval(intervalId);
                intervalId = null;
                return;
            }
            
            // Pede a localização atual do dispositivo
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    
                    // Envia a localização para a API do servidor via Fetch
                    fetch('/api/location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deliveryId, lat: latitude, lng: longitude }),
                    })
                    .then(response => {
                        if (response.ok) console.log(`Service Worker: Localização [${latitude}, ${longitude}] enviada para o ID ${deliveryId}.`);
                    })
                    .catch(error => console.error('Service Worker: Falha ao enviar localização:', error));
                },
                error => console.error('Service Worker: Erro de Geolocalização:', error),
                { enableHighAccuracy: true } // Pede a localização mais precisa possível
            );
        }, 20000); // Intervalo de 20 segundos
    }

    if (event.data.action === 'stop') {
        console.log('Service Worker: Parando rastreamento.');
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        deliveryId = null;
    }
});
