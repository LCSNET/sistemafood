import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';

import db from './database.js';
import { initializeWhatsAppBot } from './bot/whatsappBot.js'; // CORREÇÃO: Linha descomentada

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middlewares e Configuração de Upload ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// Produtos
app.get('/api/produtos', (req, res) => {
    const produtos = db.prepare('SELECT p.*, c.nome as categoria_nome FROM produtos p JOIN categorias c ON p.categoria_id = c.id ORDER BY p.nome').all();
    const variacoes = db.prepare('SELECT * FROM variacoes').all();
    produtos.forEach(p => { p.variacoes = variacoes.filter(v => v.produto_id === p.id); });
    res.json(produtos);
});

app.post('/api/produtos', upload.single('imagem'), (req, res) => {
    const { nome, descricao, categoria_id, variacoes } = req.body;
    const imagem = req.file ? `/uploads/${req.file.filename}` : null;
    db.transaction(() => {
        const pResult = db.prepare('INSERT INTO produtos (nome, descricao, imagem, categoria_id) VALUES (?, ?, ?, ?)').run(nome, descricao, imagem, categoria_id);
        const pId = pResult.lastInsertRowid;
        const variacaoStmt = db.prepare('INSERT INTO variacoes (produto_id, nome, preco) VALUES (?, ?, ?)');
        JSON.parse(variacoes).forEach(v => variacaoStmt.run(pId, v.nome, v.preco));
    })();
    io.emit('dataChanged');
    res.status(201).json({ message: 'Produto criado' });
});

app.put('/api/produtos/:id', upload.single('imagem'), (req, res) => {
    const { id } = req.params;
    const { nome, descricao, categoria_id, variacoes, imagem_existente } = req.body;
    let imagem = imagem_existente;
    if (req.file) {
        imagem = `/uploads/${req.file.filename}`;
        if (imagem_existente && fs.existsSync(path.join(__dirname, 'public', imagem_existente))) {
            fs.unlinkSync(path.join(__dirname, 'public', imagem_existente));
        }
    }
    db.transaction(() => {
        db.prepare('UPDATE produtos SET nome=?, descricao=?, imagem=?, categoria_id=? WHERE id=?').run(nome, descricao, imagem, categoria_id, id);
        db.prepare('DELETE FROM variacoes WHERE produto_id = ?').run(id);
        const variacaoStmt = db.prepare('INSERT INTO variacoes (produto_id, nome, preco) VALUES (?, ?, ?)');
        JSON.parse(variacoes).forEach(v => variacaoStmt.run(id, v.nome, v.preco));
    })();
    io.emit('dataChanged');
    res.status(200).json({ message: 'Produto atualizado' });
});

app.delete('/api/produtos/:id', (req, res) => {
    const produto = db.prepare('SELECT imagem FROM produtos WHERE id = ?').get(req.params.id);
    if (produto && produto.imagem && fs.existsSync(path.join(__dirname, 'public', produto.imagem))) {
        fs.unlinkSync(path.join(__dirname, 'public', produto.imagem));
    }
    db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
    io.emit('dataChanged');
    res.status(200).json({ message: 'Produto deletado' });
});

// Categorias
app.get('/api/categorias', (req, res) => res.json(db.prepare('SELECT * FROM categorias ORDER BY nome').all()));
app.post('/api/categorias', (req, res) => {
    const { nome } = req.body;
    db.prepare('INSERT INTO categorias (nome) VALUES (?)').run(nome);
    io.emit('dataChanged');
    res.status(201).json({ message: 'Categoria criada' });
});

// Pedidos
app.get('/api/pedidos', (req, res) => res.json(db.prepare('SELECT * FROM pedidos ORDER BY created_at DESC').all()));
app.post('/api/pedidos', (req, res) => {
    const { cliente_nome, cliente_whatsapp, endereco, total, detalhes } = req.body;
    const result = db.prepare('INSERT INTO pedidos (cliente_nome, cliente_whatsapp, endereco, total, detalhes, status) VALUES (?, ?, ?, ?, ?, ?)').run(cliente_nome, cliente_whatsapp, endereco, total, detalhes, 'Novo');
    const novoPedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(result.lastInsertRowid);
    io.emit('newOrder', novoPedido);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
});

// Entregadores
app.get('/api/entregadores', (req, res) => res.json(db.prepare('SELECT * FROM entregadores').all()));
app.post('/api/entregadores', (req, res) => {
    const { nome, telefone } = req.body;
    db.prepare('INSERT INTO entregadores (nome, telefone) VALUES (?, ?)').run(nome, telefone);
    io.emit('dataChanged');
    res.status(201).json({ message: 'Entregador criado' });
});
app.delete('/api/entregadores/:id', (req, res) => {
    db.prepare('DELETE FROM entregadores WHERE id = ?').run(req.params.id);
    io.emit('dataChanged');
    res.status(200).json({ message: 'Entregador deletado' });
});

// Localização
app.post('/api/location', (req, res) => {
    const { deliveryId, lat, lng } = req.body;
    io.emit('deliveryLocationUpdated', { deliveryId, lat, lng });
    res.json({ success: true });
});

// --- Lógica do Socket.IO ---
io.on('connection', (socket) => {
    console.log('Painel conectado:', socket.id);
    socket.on('updateOrderStatus', ({ pedidoId, status }) => {
        db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, pedidoId);
        io.emit('orderStatusUpdated', { pedidoId, status });
    });
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Cardápio do Cliente: http://localhost:${PORT}/menu/`);
    console.log(`Painel de Gestão:    http://localhost:${PORT}/admin/`);
    console.log(`App do Entregador:   http://localhost:${PORT}/delivery/`);
    initializeWhatsAppBot(io, db).catch(err => console.error("Falha ao iniciar Bot do WhatsApp:", err));
});
