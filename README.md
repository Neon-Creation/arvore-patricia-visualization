# Árvore PATRICIA · Visualizador interativo

Visualização didática de uma **árvore digital compacta** — a PATRICIA — com dois modos:

- **Palavras** (padrão): uma *radix tree* compacta em que os nós internos guardam prefixos comuns e as arestas revelam a próxima letra.
- **Bits**: a PATRICIA binária clássica, com o índice do bit testado no eixo vertical.

O site é 100% estático (HTML, CSS e JavaScript puro), sem build e sem dependências locais: basta abrir o `index.html` no navegador.

## O que dá para fazer

- **Inserir, buscar e remover palavras** de até 24 caracteres, com suporte a acentos.
- Alternar para o modo **bits** e trabalhar com chaves binárias de 3 a 8 bits.
- Acompanhar a operação **passo a passo**, com o caminho destacado na árvore e a explicação de cada decisão.
- Alternar entre **animação passo a passo** e execução instantânea.
- **Arrastar** o grafo, usar **zoom** (`+` / `−`) e reenquadrar.
- Ver estatísticas ao vivo: palavras/chaves, nós internos, altura e o limite `2k − 1`.
- Clicar em uma folha ou em uma chave do painel para buscá-la.
- Remover chaves pelos chips, carregar exemplos, inserir chaves aleatórias e limpar a árvore.
- Alternar entre **tema escuro e claro** (a preferência fica salva).

## Por que a visualização é didática

No modo palavras, cada nível mostra um **prefixo compartilhado**:

- nós internos guardam o prefixo comum dos seus descendentes;
- arestas mostram a próxima letra — ou **fim**, quando uma palavra termina naquele ponto;
- palavras que são prefixo de outras, como `casa` e `casaco`, aparecem em níveis diferentes;
- caminhos sem ramificação são “saltados”, mostrando a compactação da árvore.

No modo bits, o eixo vertical representa o **bit testado**: cada nó interno fica na linha do índice do bit que ele avalia, e todas as folhas ficam na linha de baixo.

Nos dois modos, nós internos **não guardam as chaves completas** e caminhos sem ramificação são comprimidos.

## Algoritmo implementado

### Palavras (`RadixTree`)

- Nós internos guardam um **prefixo absoluto**; as folhas guardam a palavra completa.
- O terminador `\0` representa o **fim da palavra**, permitindo que uma palavra seja prefixo de outra.
- **Busca**: compara prefixos e desce pela aresta da próxima letra até uma folha; só então compara a palavra inteira.
- **Inserção**:
  - se falta um filho, pendura uma nova folha;
  - se a divergência acontece dentro do prefixo de um nó interno, o nó é dividido;
  - se o caminho chega a uma folha, a folha é dividida no maior prefixo comum.
- **Remoção**: remove a folha e, quando o pai fica com um único filho, contrai esse nó promovendo o irmão.

### Bits (`PatriciaTree`)

- **Busca**: desce testando `bit[i]` a partir da raiz até uma folha e compara a chave inteira no final.
- **Inserção**: desce até uma folha, encontra o primeiro bit diferente e sobe enquanto o pai testar um bit maior; cria então um nó interno no bit divergente.
- **Remoção**: encontra a folha e remove o nó pai, promovendo o irmão para o lugar dele.

Com `k` chaves, a árvore tem exatamente `k` folhas e no máximo `k − 1` nós internos, totalizando no máximo `2k − 1` nós.

## Arquivos

```
index.html   estrutura da página
styles.css   tema, layout, painéis, SVG e responsividade
app.js       interface, animações, câmera, passo a passo
tree.js      modelos RadixTree e PatriciaTree (independentes do DOM)
```

O `tree.js` também funciona no Node:

```js
const { RadixTree, PatriciaTree } = require("./tree.js");

const words = new RadixTree();
words.insert("casa");
words.insert("casaco");
words.insert("cama");
console.log(words.keys()); // [ 'cama', 'casa', 'casaco' ]

const bits = new PatriciaTree(4);
bits.insert("0000");
bits.insert("1111");
console.log(bits.keys()); // [ '0000', '1111' ]
```
