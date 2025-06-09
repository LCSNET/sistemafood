import Database from 'better-sqlite3';

const db = new Database('pizzaria.db', { verbose: console.log });

function setupDatabase() {
    // Tabela de Categorias
    db.exec(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE
        );
    `);

    // Tabela Principal de Produtos
    db.exec(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            imagem TEXT,
            categoria_id INTEGER,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
        );
    `);
    
    // Tabela de Variações (tamanhos/preços)
    db.exec(`
        CREATE TABLE IF NOT EXISTS variacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER NOT NULL,
            nome TEXT NOT NULL, -- Ex: "Pequena", "Média", "Unidade"
            preco REAL NOT NULL,
            FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
        );
    `);

    // Tabela de Pedidos (sem alterações na estrutura)
    db.exec(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_nome TEXT NOT NULL,
            cliente_whatsapp TEXT NOT NULL,
            endereco TEXT NOT NULL,
            total REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'Novo',
            detalhes TEXT,
            entregador_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entregador_id) REFERENCES entregadores(id)
        );
    `);

    // Tabela de Entregadores
    db.exec(`
        CREATE TABLE IF NOT EXISTS entregadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT UNIQUE,
            status TEXT DEFAULT 'Disponível'
        );
    `);
    
    console.log("Tabelas do banco de dados verificadas/criadas.");
    seedDatabase();
}

function seedDatabase() {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM produtos').get();
    if (count > 0) return;

    console.log('Banco de dados vazio. Populando com dados iniciais...');
    db.transaction(() => {
        const insertCategoria = db.prepare('INSERT INTO categorias (nome) VALUES (?)');
        const pizzaCatId = insertCategoria.run('Pizzas').lastInsertRowid;
        const bebidaCatId = insertCategoria.run('Bebidas').lastInsertRowid;
        
        const insertProduto = db.prepare('INSERT INTO produtos (nome, descricao, imagem, categoria_id) VALUES (?, ?, ?, ?)');
        const insertVariacao = db.prepare('INSERT INTO variacoes (produto_id, nome, preco) VALUES (?, ?, ?)');

        // Pizza Calabresa com 3 tamanhos
        const calabresaId = insertProduto.run('Calabresa Suprema', 'Molho de tomate, mussarela, calabresa e cebola.', 'https://placehold.co/400x300/e63946/FFFFFF?text=Calabresa', pizzaCatId).lastInsertRowid;
        insertVariacao.run(calabresaId, 'Pequena (4 fatias)', 28.00);
        insertVariacao.run(calabresaId, 'Média (6 fatias)', 38.00);
        insertVariacao.run(calabresaId, 'Grande (8 fatias)', 48.00);

        // Pizza 4 Queijos com 3 tamanhos
        const queijosId = insertProduto.run('Quatro Queijos', 'Molho, mussarela, provolone, parmesão e gorgonzola.', 'https://placehold.co/400x300/fca311/FFFFFF?text=4+Queijos', pizzaCatId).lastInsertRowid;
        insertVariacao.run(queijosId, 'Pequena (4 fatias)', 32.00);
        insertVariacao.run(queijosId, 'Média (6 fatias)', 42.00);
        insertVariacao.run(queijosId, 'Grande (8 fatias)', 52.00);
        
        // Coca-Cola (tamanho único)
        const cocaId = insertProduto.run('Coca-Cola', 'Refrigerante lata 350ml.', 'https://placehold.co/400x300/D92B2B/FFFFFF?text=Coca-Cola', bebidaCatId).lastInsertRowid;
        insertVariacao.run(cocaId, 'Lata 350ml', 6.00);

        // Entregador de Exemplo
        db.prepare('INSERT INTO entregadores (nome, telefone) VALUES (?,?)').run('João Silva', '5511999991111');

    })();
    console.log('Dados iniciais inseridos.');
}

setupDatabase();
export default db;