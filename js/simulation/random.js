/**
 * Gerador de Números Pseudoaleatórios (PRNG) Mulberry32 e Distribuições Estocásticas Determinísticas.
 */

export class Mulberry32 {
    constructor(seed) {
        this.initialSeed = seed;
        this.state = seed >>> 0;
    }

    /**
     * Retorna um número flutuante no intervalo [0, 1)
     */
    next() {
        let t = (this.state += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Retorna um número inteiro entre min e max (inclusive)
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Amostragem de distribuição Binomial(n, p) usando o PRNG
     */
    binomial(n, p) {
        if (n <= 0 || p <= 0) return 0;
        if (p >= 1) return n;

        // Se n é pequeno ou n*p é pequeno, usar simulação de ensaios exata
        if (n <= 40) {
            let count = 0;
            for (let i = 0; i < n; i++) {
                if (this.next() < p) count++;
            }
            return count;
        }

        // Para n maior, utilizar aproximação Normal (Box-Muller) com correção de continuidade
        const mean = n * p;
        const stdDev = Math.sqrt(n * p * (1 - p));

        // Box-Muller transform usando o PRNG Mulberry32
        const u1 = Math.max(1e-10, this.next());
        const u2 = this.next();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

        let k = Math.round(mean + z0 * stdDev);
        return Math.max(0, Math.min(n, k));
    }
}
