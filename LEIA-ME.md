# Forja: app de registro de treinos

Um app de musculação no estilo dos registradores de treino: rotinas, séries, timer de descanso, recordes e gráficos de progresso.
É um app web instalável (PWA): funciona no navegador, pode ser instalado na tela inicial do celular e roda sem internet.
Os dados ficam salvos só no aparelho (use **Perfil → Configurações → Exportar backup** de vez em quando).

## O que tem

- **Treino ao vivo:** kg × reps por série, coluna "Anterior" com o último treino, marcar série como feita, tipos de série (aquecimento, drop set, até a falha), observações, cronômetro do treino.
- **Timer de descanso automático** ao marcar uma série (−15 s, +15 s, pular, som e vibração), configurável por exercício.
- **Aviso de recorde na hora:** maior peso, melhor 1RM estimado, maior volume na série, mais repetições.
- **Aquecimento automático** (40/60/80% da série de trabalho) e **calculadora de anilhas**.
- **Rotinas:** criar, editar, duplicar, começar; modelos prontos (Push/Pull/Legs, Superior/Inferior, Corpo inteiro); ao concluir, atualizar a rotina com os novos pesos.
- **Biblioteca com 161 exercícios** em português, busca, filtro por músculo e exercícios personalizados. 158 têm foto de alguém fazendo o movimento (início e fim, alternando na tela do exercício). Fotos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), domínio público.
- **Progresso:** gráfico das últimas 12 semanas (duração, volume, séries, treinos), calendário do mês, séries por grupo muscular, sequência de semanas, histórico e gráfico de 1RM de cada exercício, peso corporal.
- **Meus exercícios:** crie, edite e apague exercícios próprios, inclusive no meio do treino.
- **Editar treinos salvos:** nome, data, duração, séries; os recordes são recalculados.
- **Conforto:** tela ligada durante o treino, botão voltar do celular fecha janelas, Enter pula do peso para as reps e marca a série.
- **Segurança dos dados:** lembrete de backup a cada 2 semanas, desfazer a última importação ou limpeza, pedido de armazenamento permanente.
- kg ou lb, backup/restauração em JSON, dados de exemplo para testar.
- Abre na hora mesmo com internet ruim: usa a cópia salva e busca atualizações em segundo plano (a versão nova aparece na abertura seguinte).

## Rodar no computador

Na pasta do projeto:

```bash
python -m http.server 8765 --directory forja
```

Depois abra http://localhost:8765

## Instalar no celular

O celular precisa abrir o app por um endereço **https**. O jeito mais simples é publicar a pasta `forja` de graça no
GitHub Pages, Netlify ou Cloudflare Pages. Depois, no celular:

- **Android (Chrome):** menu ⋮ → *Instalar app*.
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Página do app |
| `app.js` | Toda a lógica (telas, treino, gráficos, dados) |
| `data.js` | Exercícios e modelos de rotina (fácil de editar) |
| `styles.css` | Visual (tema escuro, com claro automático) |
| `sw.js`, `manifest.webmanifest`, `icon*` | Instalação e funcionamento offline |
