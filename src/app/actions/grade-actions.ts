"use server";

import { revalidatePath } from "next/cache";
import { gerarPropostaGradeAutomatica } from "@/lib/services/solver-service";
import { prisma } from "@/lib/prisma";

export async function gerarGradeAutomaticaAction(periodoLetivoId: string, nomeProposta?: string) {
  try {
    const resultado = await gerarPropostaGradeAutomatica(periodoLetivoId, nomeProposta);
    revalidatePath("/");
    return { success: true, data: resultado };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao gerar grade automática." };
  }
}

export async function confirmarGradeAction(propostaId: string) {
  try {
    const atualizada = await prisma.propostaGrade.update({
      where: { id: propostaId },
      data: { status: "CONFIRMADA" },
    });
    revalidatePath("/");
    return { success: true, data: atualizada };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao confirmar grade." };
  }
}
