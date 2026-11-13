// Biblioteca de exercícios e modelos de rotina.
// kind: 'weight' = peso × reps; 'reps' = peso corporal (kg é carga extra, opcional)
window.MUSCLES = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço', 'Trapézio',
  'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Abdômen'
];

window.MUSCLE_COLORS = {
  'Peito': '#f97316', 'Costas': '#3b82f6', 'Ombros': '#a855f7', 'Bíceps': '#14b8a6',
  'Tríceps': '#ec4899', 'Antebraço': '#64748b', 'Trapézio': '#6366f1',
  'Quadríceps': '#22c55e', 'Posterior': '#eab308', 'Glúteos': '#f43f5e',
  'Panturrilha': '#0ea5e9', 'Abdômen': '#f97316'
};

window.EXERCISES = [
  // Peito
  { id: 'supino-reto-barra', name: 'Supino reto (barra)', muscle: 'Peito', equipment: 'Barra', kind: 'weight' },
  { id: 'supino-inclinado-barra', name: 'Supino inclinado (barra)', muscle: 'Peito', equipment: 'Barra', kind: 'weight' },
  { id: 'supino-reto-halter', name: 'Supino reto (halter)', muscle: 'Peito', equipment: 'Halter', kind: 'weight' },
  { id: 'supino-inclinado-halter', name: 'Supino inclinado (halter)', muscle: 'Peito', equipment: 'Halter', kind: 'weight' },
  { id: 'crucifixo-halter', name: 'Crucifixo (halter)', muscle: 'Peito', equipment: 'Halter', kind: 'weight' },
  { id: 'crossover-cabo', name: 'Crossover (cabo)', muscle: 'Peito', equipment: 'Cabo', kind: 'weight' },
  { id: 'peck-deck', name: 'Voador (máquina)', muscle: 'Peito', equipment: 'Máquina', kind: 'weight' },
  { id: 'flexao', name: 'Flexão de braço', muscle: 'Peito', equipment: 'Peso corporal', kind: 'reps' },
  { id: 'paralelas', name: 'Paralelas (mergulho)', muscle: 'Peito', equipment: 'Peso corporal', kind: 'reps' },
  // Costas
  { id: 'barra-fixa', name: 'Barra fixa', muscle: 'Costas', equipment: 'Peso corporal', kind: 'reps' },
  { id: 'puxada-frente', name: 'Puxada frontal (cabo)', muscle: 'Costas', equipment: 'Cabo', kind: 'weight' },
  { id: 'remada-curvada', name: 'Remada curvada (barra)', muscle: 'Costas', equipment: 'Barra', kind: 'weight' },
  { id: 'remada-unilateral', name: 'Remada unilateral (halter)', muscle: 'Costas', equipment: 'Halter', kind: 'weight' },
  { id: 'remada-baixa', name: 'Remada baixa (cabo)', muscle: 'Costas', equipment: 'Cabo', kind: 'weight' },
  { id: 'remada-maquina', name: 'Remada (máquina)', muscle: 'Costas', equipment: 'Máquina', kind: 'weight' },
  { id: 'levantamento-terra', name: 'Levantamento terra (barra)', muscle: 'Costas', equipment: 'Barra', kind: 'weight' },
  { id: 'pulldown-braco-reto', name: 'Pulldown braço reto (cabo)', muscle: 'Costas', equipment: 'Cabo', kind: 'weight' },
  // Ombros
  { id: 'desenvolvimento-barra', name: 'Desenvolvimento militar (barra)', muscle: 'Ombros', equipment: 'Barra', kind: 'weight' },
  { id: 'desenvolvimento-halter', name: 'Desenvolvimento (halter)', muscle: 'Ombros', equipment: 'Halter', kind: 'weight' },
  { id: 'elevacao-lateral', name: 'Elevação lateral (halter)', muscle: 'Ombros', equipment: 'Halter', kind: 'weight' },
  { id: 'elevacao-lateral-cabo', name: 'Elevação lateral (cabo)', muscle: 'Ombros', equipment: 'Cabo', kind: 'weight' },
  { id: 'elevacao-frontal', name: 'Elevação frontal (halter)', muscle: 'Ombros', equipment: 'Halter', kind: 'weight' },
  { id: 'crucifixo-inverso', name: 'Crucifixo inverso (máquina)', muscle: 'Ombros', equipment: 'Máquina', kind: 'weight' },
  { id: 'face-pull', name: 'Face pull (cabo)', muscle: 'Ombros', equipment: 'Cabo', kind: 'weight' },
  // Trapézio
  { id: 'encolhimento-halter', name: 'Encolhimento (halter)', muscle: 'Trapézio', equipment: 'Halter', kind: 'weight' },
  { id: 'encolhimento-barra', name: 'Encolhimento (barra)', muscle: 'Trapézio', equipment: 'Barra', kind: 'weight' },
  // Bíceps
  { id: 'rosca-direta-barra', name: 'Rosca direta (barra)', muscle: 'Bíceps', equipment: 'Barra', kind: 'weight' },
  { id: 'rosca-alternada', name: 'Rosca alternada (halter)', muscle: 'Bíceps', equipment: 'Halter', kind: 'weight' },
  { id: 'rosca-martelo', name: 'Rosca martelo (halter)', muscle: 'Bíceps', equipment: 'Halter', kind: 'weight' },
  { id: 'rosca-scott', name: 'Rosca Scott (máquina)', muscle: 'Bíceps', equipment: 'Máquina', kind: 'weight' },
  { id: 'rosca-cabo', name: 'Rosca (cabo)', muscle: 'Bíceps', equipment: 'Cabo', kind: 'weight' },
  // Tríceps
  { id: 'triceps-corda', name: 'Tríceps corda (cabo)', muscle: 'Tríceps', equipment: 'Cabo', kind: 'weight' },
  { id: 'triceps-barra-cabo', name: 'Tríceps pulley (barra, cabo)', muscle: 'Tríceps', equipment: 'Cabo', kind: 'weight' },
  { id: 'triceps-testa', name: 'Tríceps testa (barra W)', muscle: 'Tríceps', equipment: 'Barra', kind: 'weight' },
  { id: 'triceps-frances', name: 'Tríceps francês (halter)', muscle: 'Tríceps', equipment: 'Halter', kind: 'weight' },
  { id: 'supino-fechado', name: 'Supino fechado (barra)', muscle: 'Tríceps', equipment: 'Barra', kind: 'weight' },
  { id: 'mergulho-banco', name: 'Mergulho no banco', muscle: 'Tríceps', equipment: 'Peso corporal', kind: 'reps' },
  // Antebraço
  { id: 'rosca-punho', name: 'Rosca de punho (barra)', muscle: 'Antebraço', equipment: 'Barra', kind: 'weight' },
  // Quadríceps
  { id: 'agachamento-livre', name: 'Agachamento livre (barra)', muscle: 'Quadríceps', equipment: 'Barra', kind: 'weight' },
  { id: 'agachamento-frontal', name: 'Agachamento frontal (barra)', muscle: 'Quadríceps', equipment: 'Barra', kind: 'weight' },
  { id: 'leg-press', name: 'Leg press', muscle: 'Quadríceps', equipment: 'Máquina', kind: 'weight' },
  { id: 'cadeira-extensora', name: 'Cadeira extensora', muscle: 'Quadríceps', equipment: 'Máquina', kind: 'weight' },
  { id: 'hack', name: 'Agachamento hack (máquina)', muscle: 'Quadríceps', equipment: 'Máquina', kind: 'weight' },
  { id: 'bulgaro', name: 'Agachamento búlgaro (halter)', muscle: 'Quadríceps', equipment: 'Halter', kind: 'weight' },
  { id: 'afundo', name: 'Afundo (halter)', muscle: 'Quadríceps', equipment: 'Halter', kind: 'weight' },
  { id: 'goblet', name: 'Agachamento goblet (kettlebell)', muscle: 'Quadríceps', equipment: 'Kettlebell', kind: 'weight' },
  // Posterior
  { id: 'stiff', name: 'Stiff (barra)', muscle: 'Posterior', equipment: 'Barra', kind: 'weight' },
  { id: 'terra-romeno-halter', name: 'Terra romeno (halter)', muscle: 'Posterior', equipment: 'Halter', kind: 'weight' },
  { id: 'mesa-flexora', name: 'Mesa flexora', muscle: 'Posterior', equipment: 'Máquina', kind: 'weight' },
  { id: 'cadeira-flexora', name: 'Cadeira flexora', muscle: 'Posterior', equipment: 'Máquina', kind: 'weight' },
  // Glúteos
  { id: 'elevacao-pelvica', name: 'Elevação pélvica (barra)', muscle: 'Glúteos', equipment: 'Barra', kind: 'weight' },
  { id: 'abdutora', name: 'Cadeira abdutora', muscle: 'Glúteos', equipment: 'Máquina', kind: 'weight' },
  { id: 'gluteo-cabo', name: 'Coice de glúteo (cabo)', muscle: 'Glúteos', equipment: 'Cabo', kind: 'weight' },
  // Panturrilha
  { id: 'panturrilha-pe', name: 'Panturrilha em pé (máquina)', muscle: 'Panturrilha', equipment: 'Máquina', kind: 'weight' },
  { id: 'panturrilha-sentado', name: 'Panturrilha sentado (máquina)', muscle: 'Panturrilha', equipment: 'Máquina', kind: 'weight' },
  // Abdômen
  { id: 'abdominal-crunch', name: 'Abdominal crunch', muscle: 'Abdômen', equipment: 'Peso corporal', kind: 'reps' },
  { id: 'abdominal-cabo', name: 'Abdominal ajoelhado (cabo)', muscle: 'Abdômen', equipment: 'Cabo', kind: 'weight' },
  { id: 'elevacao-pernas', name: 'Elevação de pernas suspenso', muscle: 'Abdômen', equipment: 'Peso corporal', kind: 'reps' },
  { id: 'roda-abdominal', name: 'Roda abdominal', muscle: 'Abdômen', equipment: 'Peso corporal', kind: 'reps' },
  { id: 'russian-twist', name: 'Russian twist', muscle: 'Abdômen', equipment: 'Peso corporal', kind: 'reps' }
];

window.EQUIPMENT = ['Barra', 'Halter', 'Máquina', 'Cabo', 'Peso corporal', 'Kettlebell', 'Outro'];

// Modelos: [idDoExercício, séries, reps]
window.TEMPLATES = [
  { group: 'Push / Pull / Legs', name: 'Push (empurrar)', ex: [
    ['supino-reto-barra', 4, 8], ['supino-inclinado-halter', 3, 10], ['desenvolvimento-halter', 3, 10],
    ['elevacao-lateral', 3, 15], ['triceps-corda', 3, 12]] },
  { group: 'Push / Pull / Legs', name: 'Pull (puxar)', ex: [
    ['levantamento-terra', 3, 5], ['puxada-frente', 3, 10], ['remada-baixa', 3, 10],
    ['face-pull', 3, 15], ['rosca-alternada', 3, 12]] },
  { group: 'Push / Pull / Legs', name: 'Legs (pernas)', ex: [
    ['agachamento-livre', 4, 6], ['leg-press', 3, 10], ['stiff', 3, 10],
    ['cadeira-flexora', 3, 12], ['panturrilha-pe', 4, 12]] },
  { group: 'Superior / Inferior', name: 'Superior', ex: [
    ['supino-reto-barra', 4, 6], ['remada-curvada', 4, 8], ['desenvolvimento-barra', 3, 8],
    ['puxada-frente', 3, 10], ['rosca-direta-barra', 2, 12], ['triceps-barra-cabo', 2, 12]] },
  { group: 'Superior / Inferior', name: 'Inferior', ex: [
    ['agachamento-livre', 4, 6], ['stiff', 3, 8], ['bulgaro', 3, 10],
    ['mesa-flexora', 3, 12], ['panturrilha-sentado', 4, 15], ['abdominal-cabo', 3, 15]] },
  { group: 'Corpo inteiro', name: 'Corpo inteiro A', ex: [
    ['agachamento-livre', 3, 8], ['supino-reto-barra', 3, 8], ['remada-curvada', 3, 8],
    ['elevacao-lateral', 2, 15], ['abdominal-crunch', 3, 20]] },
  { group: 'Corpo inteiro', name: 'Corpo inteiro B', ex: [
    ['levantamento-terra', 3, 5], ['desenvolvimento-barra', 3, 8], ['barra-fixa', 3, 8],
    ['leg-press', 3, 12], ['rosca-martelo', 2, 12]] }
];
