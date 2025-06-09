import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Objeto para manter o estado da conversa de cada usuário
const userState = {};

export async function initializeWhatsAppBot(io, db) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // CORREÇÃO APLICADA AQUI: O nome do modelo foi ajustado para a versão estável.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', qr => {
        qrcode.generate(qr, { small: true });
        console.log('Escaneie o QR Code com seu WhatsApp.');
    });

    client.on('ready', () => {
        console.log('✅ Bot do WhatsApp está pronto e conectado!');
    });

    client.on('message', async message => {
        const from = message.from;
        const body = message.body.trim();
        const contact = await message.getContact();
        const nomeCliente = contact.pushname || 'Cliente';

        if (body.toLowerCase() === '!reset' || body.toLowerCase() === 'reiniciar') {
            delete userState[from];
            message.reply('Sua conversa foi reiniciada. Como posso te ajudar?');
            return;
        }

        if (!userState[from]) {
            userState[from] = { history: [] };
        }
        
        const produtos = db.prepare('SELECT p.id, p.nome, p.descricao, c.nome as categoria_nome FROM produtos p JOIN categorias c ON p.categoria_id = c.id ORDER BY c.id, p.nome').all();
        const variacoes = db.prepare('SELECT * FROM variacoes').all();

        let cardapioText = '';
        let currentCategory = '';

        produtos.forEach(produto => {
            if (produto.categoria_nome !== currentCategory) {
                currentCategory = produto.categoria_nome;
                cardapioText += `\n\n*--- ${currentCategory.toUpperCase()} ---*\n`;
            }

            const produtoVariacoes = variacoes.filter(v => v.produto_id === produto.id);
            
            cardapioText += `\n*${produto.nome}*`;
            if (produto.descricao) {
                cardapioText += `\n_${produto.descricao}_`;
            }
            
            produtoVariacoes.forEach(v => {
                cardapioText += `\n- ${v.nome}: R$ ${v.preco.toFixed(2)}`;
            });
        });
        
        const instructions = `
            Você é a Tacy, atendente virtual da Pizzaria ZapFood.
            Seu objetivo é guiar o cliente pelo pedido.
            - Seja amigável e use emojis.
            - Se o cliente pedir o cardápio, envie o texto completo que está em [CARDAPIO].
            - Ajude o cliente a montar um pedido. Pergunte sobre itens, endereço e confirme tudo no final.
            - Quando o pedido for confirmado, diga que ele será adicionado ao sistema e que ele receberá atualizações.
            
            Histórico da conversa:
            ${userState[from].history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n')}

            [CARDAPIO]
            ${cardapioText}
            [/CARDAPIO]
        `;

        try {
            const chat = model.startChat({ history: userState[from].history });
            const result = await chat.sendMessage(instructions + "\n\nMensagem do cliente: " + body);
            const response = await result.response;
            const text = response.text();
            
            if (text.toLowerCase().includes("pedido confirmado") || text.toLowerCase().includes("anotado")) {
                 message.reply(text + "\n\nSeu pedido será encaminhado para a cozinha!");
            } else {
                 message.reply(text);
            }
            
            userState[from].history.push({ role: "user", parts: [{ text: body }] });
            userState[from].history.push({ role: "model", parts: [{ text: text }] });

        } catch (error) {
            console.error("ERRO DETALHADO AO COMUNICAR COM O GEMINI:");
            console.error(JSON.stringify(error, null, 2)); 
            message.reply("Desculpe, estou com um problema no meu sistema. Tente novamente em alguns instantes.");
        }
    });

    await client.initialize();
    return client;
}