import { describe, expect, it } from "vitest";
import { paraCamposLocais, paraUTC } from "@/lib/fuso";
import { formatarData, formatarDataHora, formatarHora } from "@/lib/format";

/**
 * O grupo joga em Maceió (UTC-3, sem horário de verão). O administrador
 * digita 20:00 pensando no relógio dele; o banco precisa guardar 23:00 UTC.
 */
describe("fuso do grupo", () => {
  it("converte o horário digitado para UTC", () => {
    const instante = paraUTC("2026-09-15", "20:00");
    expect(instante.toISOString()).toBe("2026-09-15T23:00:00.000Z");
  });

  it("volta do UTC para os campos do formulário sem perder o horário", () => {
    const campos = paraCamposLocais("2026-09-15T23:00:00.000Z");
    expect(campos).toEqual({ data: "2026-09-15", hora: "20:00" });
  });

  it("mantém a data correta quando o horário atravessa a meia-noite em UTC", () => {
    const instante = paraUTC("2026-09-15", "22:00");
    expect(instante.toISOString()).toBe("2026-09-16T01:00:00.000Z");
    expect(paraCamposLocais(instante)).toEqual({ data: "2026-09-15", hora: "22:00" });
  });

  it("exibe data e hora no formato brasileiro", () => {
    const instante = paraUTC("2026-09-15", "20:00");
    expect(formatarData(instante)).toBe("15/09/2026");
    expect(formatarHora(instante)).toBe("20:00");
    expect(formatarDataHora(instante)).toBe("15/09/2026 às 20:00");
  });
});
