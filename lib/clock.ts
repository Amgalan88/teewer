// Одоогийн цаг. Симуляци (scripts/demo.ts) цагийг урагшлуулж, өнгөрсөн мөчлөгүүдийг дуурайлгана.
let fixed: Date | null = null;

export function now() {
  return fixed ? new Date(fixed) : new Date();
}

export function setNow(d: Date | null) {
  fixed = d ? new Date(d) : null;
}
