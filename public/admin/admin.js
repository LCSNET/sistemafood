document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANTE: Substitua pelo IP público da sua VM na Azure
    const API_URL = 'http://20.197.224.54:3000'; // Exemplo: http://20.226.78.123:3000

    const socket = io(API_URL);
    let state = { categorias: [], produtos: [], entregadores: [], pedidos: [] };

    // --- Elementos Globais ---
    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const modalContainer = document.getElementById('modal-container');
    const map = L.map('map-container').setView([-22.9068, -43.1729], 12); // Centro no Rio de Janeiro
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    let deliveryMarkers = {};

    // --- Navegação ---
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const viewId = `${link.dataset.view}-view`;
            views.forEach(v => v.classList.toggle('active', v.id === viewId));
            if (viewId === 'entregadores-view') setTimeout(() => map.invalidateSize(), 10);
        });
    });

    // --- Funções de Requisição ---
    async function fetchAll() {
        try {
            const [p, c, e, pd] = await Promise.all([
                fetch(`${API_URL}/api/produtos`), 
                fetch(`${API_URL}/api/categorias`), 
                fetch(`${API_URL}/api/entregadores`), 
                fetch(`${API_URL}/api/pedidos`)
            ]);
            state.produtos = await p.json();
            state.categorias = await c.json();
            state.entregadores = await e.json();
            state.pedidos = await pd.json();
            render.all();
        } catch (error) { 
            console.error("Falha ao buscar dados:", error); 
            alert("Não foi possível conectar ao servidor. Verifique o endereço da API e se o servidor está online.");
        }
    }

    // --- Funções de Renderização ---
    const render = {
        all: () => {
            render.pedidos();
            render.cardapioAdmin();
            render.entregadores();
        },
        pedidos: () => {
            const container = document.getElementById('pedidos-container');
            container.innerHTML = state.pedidos.length > 0
                ? state.pedidos.map(criarCardPedido).join('')
                : '<p class="text-gray-400 col-span-full">Nenhum pedido no momento.</p>';
        },
        cardapioAdmin: () => {
            const container = document.getElementById('cardapio-gerenciamento-container');
            container.innerHTML = state.categorias.map(cat => {
                const produtosHTML = state.produtos
                    .filter(p => p.categoria_id === cat.id)
                    .map(p => `
                        <div class="flex items-center justify-between p-2 bg-gray-900 rounded-md">
                            <span class="truncate pr-2">${p.nome}</span>
                            <div class="flex-shrink-0">
                                <button class="text-blue-400 hover:text-blue-300 mr-2 btn-edit-produto" data-id="${p.id}" title="Editar"><i class="fas fa-edit"></i></button>
                                <button class="text-red-500 hover:text-red-400 btn-delete-produto" data-id="${p.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`).join('');
                return `<div class="card"><h3 class="text-xl font-bold mb-3">${cat.nome}</h3><div class="space-y-2">${produtosHTML || '<p class="text-sm text-gray-500">Nenhum produto nesta categoria.</p>'}</div></div>`;
            }).join('');
        },
        entregadores: () => {
            const container = document.getElementById('entregadores-lista');
            container.innerHTML = state.entregadores.map(e => `
                <div class="card p-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold">${e.nome}</p>
                            <p class="text-sm text-yellow-400">ID para Login: ${e.id}</p>
                            <p class="text-xs text-gray-400">${e.telefone || 'Sem telefone'}</p>
                        </div>
                        <button class="text-red-500 hover:text-red-400 btn-delete-entregador" data-id="${e.id}" title="Excluir Entregador"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`).join('');
        }
    };
    
    // --- Lógica dos Modais ---
    const modals = {
        show: (content) => {
            modalContainer.innerHTML = `<div class="modal-container fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">${content}</div>`;
            modalContainer.classList.remove('hidden');
            modalContainer.querySelector('.modal-container').addEventListener('click', e => {
                 if (e.target === e.currentTarget) modals.close();
            });
        },
        close: () => {
            modalContainer.innerHTML = '';
            modalContainer.classList.add('hidden');
        },
        showCategoria: () => {
             modals.show(`
                <div class="card w-full max-w-md">
                    <h2 class="text-2xl font-bold mb-4">Nova Categoria</h2>
                    <form id="categoria-form" class="space-y-4">
                        <input type="text" id="categoria-nome" placeholder="Nome da Categoria" required class="w-full p-3 bg-gray-900 rounded-lg">
                        <div class="flex justify-end gap-4">
                            <button type="button" class="btn-cancel bg-gray-600 p-2 rounded">Cancelar</button>
                            <button type="submit" class="bg-green-600 p-2 rounded">Salvar</button>
                        </div>
                    </form>
                </div>`);
        },
        showEntregador: () => {
            modals.show(`
                 <div class="card w-full max-w-md">
                    <h2 class="text-2xl font-bold mb-4">Novo Entregador</h2>
                    <form id="entregador-form" class="space-y-4">
                        <input type="text" id="entregador-nome" placeholder="Nome do Entregador" required class="w-full p-3 bg-gray-900 rounded-lg">
                        <input type="tel" id="entregador-telefone" placeholder="Telefone (opcional)" class="w-full p-3 bg-gray-900 rounded-lg">
                        <div class="flex justify-end gap-4">
                            <button type="button" class="btn-cancel bg-gray-600 p-2 rounded">Cancelar</button>
                            <button type="submit" class="bg-green-600 p-2 rounded">Salvar</button>
                        </div>
                    </form>
                </div>`);
        },
        showProduto: (produto = null) => {
            const isEditing = produto !== null;
            const categoriasOptions = state.categorias.map(c => `<option value="${c.id}" ${isEditing && produto.categoria_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
            const variacoesHTML = (isEditing && produto.variacoes.length > 0 ? produto.variacoes : [{ nome: '', preco: '' }]).map(v => `
                <div class="flex gap-2 variacao-row">
                    <input type="text" placeholder="Nome (ex: Grande)" class="w-2/3 bg-gray-700 p-2 rounded-md variacao-nome" value="${v.nome || ''}" required>
                    <input type="number" step="0.01" placeholder="Preço" class="w-1/3 bg-gray-700 p-2 rounded-md variacao-preco" value="${v.preco || ''}" required>
                    <button type="button" class="text-red-500 btn-remove-variacao" title="Remover"><i class="fas fa-times"></i></button>
                </div>
            `).join('');

            modals.show(`
                <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <h2 class="text-2xl font-bold mb-6">${isEditing ? 'Editar' : 'Adicionar'} Produto</h2>
                    <form id="produto-form" class="space-y-4" data-id="${isEditing ? produto.id : ''}">
                        <input type="text" id="produto-nome" placeholder="Nome do Produto" required class="w-full p-3 bg-gray-900 rounded-lg" value="${produto?.nome || ''}">
                        <textarea id="produto-descricao" placeholder="Descrição" rows="3" class="w-full p-3 bg-gray-900 rounded-lg resize-none">${produto?.descricao || ''}</textarea>
                        <select id="produto-categoria" required class="w-full p-3 bg-gray-900 rounded-lg">${categoriasOptions}</select>
                        <div>
                            <label class="block mb-2 text-sm font-medium">Tamanhos e Preços</label>
                            <div id="variacoes-container" class="space-y-2">${variacoesHTML}</div>
                            <button type="button" class="btn-add-variacao text-sm text-yellow-400 mt-2">+ Adicionar Tamanho/Preço</button>
                        </div>
                        <div>
                            <label class="block mb-2 text-sm font-medium">Imagem</label>
                            <input type="file" id="produto-imagem" accept="image/*" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-yellow-500 file:text-gray-900 hover:file:bg-yellow-600">
                            ${isEditing && produto.imagem ? `<input type="hidden" id="imagem-existente" value="${produto.imagem}"><img src="${produto.imagem}" class="w-20 h-20 mt-2 object-cover rounded">` : ''}
                        </div>
                        <div class="flex justify-end gap-4 pt-4">
                            <button type="button" class="btn-cancel bg-gray-600 p-2 rounded">Cancelar</button>
                            <button type="submit" class="bg-green-600 p-2 rounded">Salvar Produto</button>
                        </div>
                    </form>
                </div>`);
        }
    };
    
    // --- Requisições e Submissões ---
    
    async function submitProdutoForm(form) {
        const id = form.dataset.id;
        const variacoes = Array.from(form.querySelectorAll('.variacao-row')).map(row => ({
            nome: row.querySelector('.variacao-nome').value,
            preco: parseFloat(row.querySelector('.variacao-preco').value)
        })).filter(v => v.nome && v.preco > 0);

        if (variacoes.length === 0) {
            alert('Adicione pelo menos um tamanho/preço válido.'); return;
        }

        const formData = new FormData();
        formData.append('nome', form.querySelector('#produto-nome').value);
        formData.append('descricao', form.querySelector('#produto-descricao').value);
        formData.append('categoria_id', form.querySelector('#produto-categoria').value);
        formData.append('variacoes', JSON.stringify(variacoes));
        const imagemFile = form.querySelector('#produto-imagem').files[0];
        if (imagemFile) formData.append('imagem', imagemFile);
        const imagemExistente = form.querySelector('#imagem-existente');
        if (imagemExistente) formData.append('imagem_existente', imagemExistente.value);

        const url = id ? `${API_URL}/api/produtos/${id}` : `${API_URL}/api/produtos`;
        const method = id ? 'PUT' : 'POST';

        await fetch(url, { method, body: formData });
        modals.close();
    }
    
    // --- Event Listeners Dinâmicos (delegação) ---
    document.body.addEventListener('click', async e => {
        const target = e.target;
        const btnCancel = target.closest('.btn-cancel');
        if (btnCancel) { modals.close(); return; }

        if (target.id === 'btn-add-categoria') modals.showCategoria();
        if (target.id === 'btn-add-produto') modals.showProduto();
        if (target.id === 'btn-add-entregador') modals.showEntregador();
        
        const btnEditProduto = target.closest('.btn-edit-produto');
        if (btnEditProduto) {
            const produto = state.produtos.find(p => p.id == btnEditProduto.dataset.id);
            modals.showProduto(produto);
        }

        const btnDeleteProduto = target.closest('.btn-delete-produto');
        if (btnDeleteProduto) {
            if (confirm('Tem certeza que deseja excluir este produto?')) {
                await fetch(`${API_URL}/api/produtos/${btnDeleteProduto.dataset.id}`, { method: 'DELETE' });
            }
        }
        
        const btnDeleteEntregador = target.closest('.btn-delete-entregador');
        if (btnDeleteEntregador) {
            if (confirm('Tem certeza que deseja excluir este entregador?')) {
                await fetch(`${API_URL}/api/entregadores/${btnDeleteEntregador.dataset.id}`, { method: 'DELETE' });
            }
        }
        
        const modal = target.closest('.modal-container');
        if (modal) {
            if(target.closest('.btn-add-variacao')) {
                const container = document.getElementById('variacoes-container');
                const newRow = document.createElement('div');
                newRow.className = 'flex gap-2 variacao-row';
                newRow.innerHTML = `
                    <input type="text" placeholder="Nome (ex: Grande)" class="w-2/3 bg-gray-700 p-2 rounded-md variacao-nome" required>
                    <input type="number" step="0.01" placeholder="Preço" class="w-1/3 bg-gray-700 p-2 rounded-md variacao-preco" required>
                    <button type="button" class="text-red-500 btn-remove-variacao" title="Remover"><i class="fas fa-times"></i></button>`;
                container.appendChild(newRow);
            }
            if(target.closest('.btn-remove-variacao')) {
                target.closest('.variacao-row').remove();
            }

            const form = target.closest('form');
            if(form) {
                 form.addEventListener('submit', async ev => {
                    ev.preventDefault();
                    if(form.id === 'produto-form') await submitProdutoForm(form);
                    if(form.id === 'categoria-form') {
                        await fetch(`${API_URL}/api/categorias`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nome: form.querySelector('#categoria-nome').value }) });
                        modals.close();
                    }
                    if(form.id === 'entregador-form') {
                        await fetch(`${API_URL}/api/entregadores`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nome: form.querySelector('#entregador-nome').value, telefone: form.querySelector('#entregador-telefone').value }) });
                        modals.close();
                    }
                 }, { once: true });
            }
        }
    });

    // --- Sockets e Inicialização ---
    async function fetchAll() {
        try {
            const [p, c, e, pd] = await Promise.all([
                fetch(`${API_URL}/api/produtos`), 
                fetch(`${API_URL}/api/categorias`), 
                fetch(`${API_URL}/api/entregadores`), 
                fetch(`${API_URL}/api/pedidos`)
            ]);
            state.produtos = await p.json();
            state.categorias = await c.json();
            state.entregadores = await e.json();
            state.pedidos = await pd.json();
            render.all();
        } catch (error) { console.error("Falha ao buscar dados:", error); }
    }
    
    function criarCardPedido(pedido) {
        const statusClasses = { 'Novo': 'status-novo', 'Em Preparo': 'status-em-preparo', 'Pronto': 'status-pronto', 'Em Rota': 'status-em-rota', 'Entregue': 'status-entregue', 'Cancelado': 'status-cancelado' };
        let detalhesFormatados = 'Sem detalhes';
        try {
            const itens = JSON.parse(pedido.detalhes);
            detalhesFormatados = itens.map(item => `<li>- ${item.nome} (R$ ${item.preco.toFixed(2)})</li>`).join('');
        } catch(e) {}

        return `
            <div class="card" id="pedido-${pedido.id}">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-xl font-bold">Pedido #${pedido.id}</h3>
                        <p class="text-sm text-gray-300">${pedido.cliente_nome}</p>
                    </div>
                    <span class="px-3 py-1 text-sm font-semibold rounded-full whitespace-nowrap ${statusClasses[pedido.status] || 'bg-gray-500'}">${pedido.status}</span>
                </div>
                <div class="mt-4">
                    <p class="font-semibold">Itens:</p>
                    <ul class="list-disc list-inside text-gray-300 text-sm">${detalhesFormatados}</ul>
                    <p class="text-right font-bold text-lg text-green-400 mt-2">Total: R$ ${pedido.total.toFixed(2)}</p>
                </div>
                <div class="mt-4">
                    <select class="status-select bg-gray-700 p-2 rounded-md w-full" data-id="${pedido.id}">
                        ${['Novo', 'Em Preparo', 'Pronto', 'Em Rota', 'Entregue', 'Cancelado'].map(s => `<option value="${s}" ${pedido.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>`;
    }
    
    document.getElementById('pedidos-container').addEventListener('change', e => {
        if (e.target.classList.contains('status-select')) {
            socket.emit('updateOrderStatus', { pedidoId: e.target.dataset.id, status: e.target.value });
        }
    });

    socket.on('dataChanged', fetchAll);
    socket.on('newOrder', fetchAll);
    socket.on('orderStatusUpdated', fetchAll);
    socket.on('deliveryLocationUpdated', ({ deliveryId, lat, lng }) => {
        const entregador = state.entregadores.find(e => e.id == deliveryId);
        const markerLabel = entregador ? `${entregador.nome} (ID: ${deliveryId})` : `Entregador ID: ${deliveryId}`;
        if (!deliveryMarkers[deliveryId]) {
            deliveryMarkers[deliveryId] = L.marker([lat, lng]).addTo(map).bindPopup(markerLabel);
        }
        deliveryMarkers[deliveryId].setLatLng([lat, lng]).openPopup();
        map.panTo([lat, lng]);
    });
    
    fetchAll();
});
