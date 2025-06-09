document.addEventListener('DOMContentLoaded', () => {
    // --- URL da sua API na Azure ---
    // O IP que você forneceu já está configurado.
    const API_URL = 'http://20.197.224.54:3000';

    // --- Referências do DOM ---
    const menuContainer = document.getElementById('menu-container');
    const listaCarrinhoModal = document.getElementById('lista-carrinho-modal');
    const totalModalElement = document.getElementById('total-modal');
    const cartCountElement = document.getElementById('cart-count');
    const verCarrinhoBtn = document.getElementById('ver-carrinho-btn');
    const checkoutModal = document.getElementById('checkout-modal');
    const fecharModalBtn = document.getElementById('fechar-modal-btn');
    const formFinalizar = document.getElementById('form-finalizar');
    const currentYearElement = document.getElementById('currentYear');
    const toastNotificationElement = document.getElementById('toast-notification');
    const cartReviewStep = document.getElementById('cart-review-step');
    const checkoutDetailsStep = document.getElementById('checkout-details-step');
    const btnAvancarCheckout = document.getElementById('btn-avancar-checkout');
    const btnVoltarCarrinho = document.getElementById('btn-voltar-carrinho');
    const pagamentoSelect = document.getElementById('pagamento');
    const campoTrocoDiv = document.getElementById('campo-troco');
    
    // --- Estado da Aplicação ---
    let carrinho = [];
    let produtosDisponiveis = [];

    // --- Funções Principais ---

    async function carregarCardapio() {
        try {
            const [categoriasRes, produtosRes] = await Promise.all([ 
                fetch(`${API_URL}/api/categorias`), 
                fetch(`${API_URL}/api/produtos`) 
            ]);
            if (!categoriasRes.ok || !produtosRes.ok) {
                throw new Error('Não foi possível carregar o cardápio do servidor.');
            }
            const categorias = await categoriasRes.json();
            produtosDisponiveis = await produtosRes.json();
            renderizarCardapio(categorias, produtosDisponiveis);
        } catch (error) {
            menuContainer.innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
        }
    }

    function renderizarCardapio(categorias, produtos) {
        menuContainer.innerHTML = '';
        if (categorias.length === 0) {
            menuContainer.innerHTML = '<p class="text-gray-400 text-center">Nenhum item no cardápio no momento.</p>';
            return;
        }
        categorias.forEach(cat => {
            const produtosDaCategoria = produtos.filter(p => p.categoria_id === cat.id);
            if (produtosDaCategoria.length === 0) return;
            const produtosHTML = produtosDaCategoria.map(criarCardProduto).join('');
            menuContainer.innerHTML += `
                <section class="mb-16">
                    <h2 class="font-playfair text-4xl font-bold text-center mb-10 text-yellow-500">${cat.nome}</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${produtosHTML}</div>
                </section>`;
        });
    }

    function criarCardProduto(produto) {
        let priceOrSelectHTML;
        if (produto.variacoes.length > 1) {
            const options = produto.variacoes.map(v => `<option value="${v.id}">${v.nome} - R$ ${v.preco.toFixed(2)}</option>`).join('');
            priceOrSelectHTML = `<select class="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white variacao-select">${options}</select>`;
        } else if (produto.variacoes.length === 1) {
            priceOrSelectHTML = `<span class="text-xl font-bold text-green-400">R$ ${produto.variacoes[0].preco.toFixed(2)}</span>`;
        } else {
             priceOrSelectHTML = `<span class="text-base font-bold text-red-400">Indisponível</span>`;
        }
        return `
            <div class="product-card flex flex-col" data-produto-id="${produto.id}">
                <div class="overflow-hidden h-56"><img src="${API_URL}${produto.imagem}" alt="[Imagem de ${produto.nome}]" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/600x400/1f2937/f3f4f6?text=Sem+Imagem'"></div>
                <div class="p-5 flex flex-col flex-grow">
                    <h3 class="font-playfair text-2xl font-bold text-yellow-400">${produto.nome}</h3>
                    <p class="text-sm text-gray-400 my-2 flex-grow">${produto.descricao}</p>
                    <div class="flex justify-between items-center mt-4">
                        ${priceOrSelectHTML}
                        <button class="btn-primary font-semibold py-2 px-4 rounded-lg add-item-btn ml-4" ${produto.variacoes.length === 0 ? 'disabled' : ''}><i class="fas fa-cart-plus"></i></button>
                    </div>
                </div>
            </div>`;
    }

    function atualizarCarrinhoDisplay() {
        listaCarrinhoModal.innerHTML = '';
        const total = carrinho.reduce((acc, item) => acc + item.preco, 0);
        carrinho.forEach((item, index) => {
            listaCarrinhoModal.innerHTML += `
                <li class="flex justify-between items-center p-3 bg-gray-900 rounded-md">
                    <span class="flex-1">${item.nome}</span>
                    <div class="flex items-center">
                        <span class="mr-4 font-semibold">R$ ${item.preco.toFixed(2)}</span>
                        <button class="text-red-500 hover:text-red-400 remover-item-btn" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </li>`;
        });
        totalModalElement.textContent = total.toFixed(2);
        cartCountElement.textContent = carrinho.length;
        cartCountElement.classList.toggle('hidden', carrinho.length === 0);
    }
    
    function showToast(message) {
        toastNotificationElement.textContent = message;
        toastNotificationElement.classList.add("show");
        setTimeout(() => toastNotificationElement.classList.remove("show"), 3000);
    }

    // --- Event Listeners ---
    menuContainer.addEventListener('click', (e) => {
        const addButton = e.target.closest('.add-item-btn');
        if (addButton) {
            const card = addButton.closest('.product-card');
            const produtoId = parseInt(card.dataset.produtoId);
            const produto = produtosDisponiveis.find(p => p.id === produtoId);
            if (!produto || produto.variacoes.length === 0) return;

            const select = card.querySelector('.variacao-select');
            const variacaoId = select ? parseInt(select.value) : produto.variacoes[0].id;
            const variacao = produto.variacoes.find(v => v.id === variacaoId);
            
            carrinho.push({ nome: `${produto.nome} (${variacao.nome})`, preco: variacao.preco });
            showToast(`${produto.nome} adicionado!`);
            atualizarCarrinhoDisplay();
        }
    });

    listaCarrinhoModal.addEventListener('click', e => {
        const removeButton = e.target.closest('.remover-item-btn');
        if(removeButton) {
            carrinho.splice(parseInt(removeButton.dataset.index), 1);
            atualizarCarrinhoDisplay();
        }
    });
    
    // --- Lógica de Modal e Checkout ---
    
    verCarrinhoBtn.addEventListener("click", () => {
        if (carrinho.length === 0) {
            showToast("O seu carrinho está vazio!");
            return;
        }
        checkoutModal.classList.remove("hidden");
        checkoutModal.classList.add("flex");
        cartReviewStep.classList.remove("hidden");
        checkoutDetailsStep.classList.add("hidden");
    });
    
    fecharModalBtn.addEventListener("click", () => checkoutModal.classList.add("hidden"));
    checkoutModal.addEventListener('click', (e) => {
        if(e.target === e.currentTarget) checkoutModal.classList.add("hidden");
    });

    btnAvancarCheckout.addEventListener("click", () => {
        cartReviewStep.classList.add("hidden");
        checkoutDetailsStep.classList.remove("hidden");
    });
    btnVoltarCarrinho.addEventListener("click", () => {
        checkoutDetailsStep.classList.add("hidden");
        cartReviewStep.classList.remove("hidden");
    });
     pagamentoSelect.addEventListener("change", (e) => {
        campoTrocoDiv.classList.toggle("hidden", e.target.value !== "Dinheiro");
    });

    formFinalizar.addEventListener('submit', async e => {
        e.preventDefault();
        const nome = document.getElementById('nome').value;
        const endereco = document.getElementById('endereco').value;
        const whatsapp = document.getElementById('whatsapp-number').value;
        const pagamento = document.getElementById('pagamento').value;
        const observacoes = document.getElementById('observacoes').value.trim();
        const trocoPara = document.getElementById('troco_para').value;
        const total = carrinho.reduce((acc, item) => acc + item.preco, 0);

        try {
            const res = await fetch(`${API_URL}/api/pedidos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_nome: nome,
                    cliente_whatsapp: whatsapp,
                    endereco: endereco,
                    total: total,
                    detalhes: JSON.stringify(carrinho)
                })
            });
            if (!res.ok) throw new Error('Falha ao registar o pedido');
            const novoPedido = await res.json();
            
            let mensagem = `*-- NOVO PEDIDO #${novoPedido.id} --*\n\n` +
                         `*CLIENTE:* ${nome}\n` +
                         `*ENDEREÇO:* ${endereco}\n\n` +
                         `*ITENS:*\n` +
                         carrinho.map(item => `• ${item.nome} - R$ ${item.preco.toFixed(2)}`).join('\n') +
                         `\n\n*TOTAL: R$ ${total.toFixed(2)}*\n` +
                         `*PAGAMENTO:* ${pagamento}\n` +
                         (pagamento === 'Dinheiro' && trocoPara ? `*TROCO PARA:* R$ ${trocoPara}\n` : '') +
                         (observacoes ? `*OBS:* ${observacoes}` : '');

            const numeroWhatsAppPizzaria = "5535999225307"; // SUBSTITUA PELO SEU NÚMERO
            window.open(`https://wa.me/${numeroWhatsAppPizzaria}?text=${encodeURIComponent(mensagem)}`, '_blank');
            
            carrinho = [];
            formFinalizar.reset();
            checkoutModal.classList.add('hidden');
            atualizarCarrinhoDisplay();
            showToast('Pedido enviado com sucesso!');

        } catch (error) {
            showToast('Erro ao enviar o pedido. Tente novamente.');
            console.error(error);
        }
    });
    
    // --- Inicialização ---
    if(currentYearElement) currentYearElement.textContent = new Date().getFullYear();
    carregarCardapio();
});
