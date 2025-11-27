import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

interface Subtask {
  id: string;
  title: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  subtasks: Subtask[];
}

interface AIAnalysisPlanProps {
  isAnalyzing: boolean;
  onComplete?: () => void;
}

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Coleta de Dados",
    description: "Buscar todos os dados relacionados ao lead",
    status: "pending",
    subtasks: [
      { id: "1.1", title: "Buscar dados do lead", status: "pending" },
      { id: "1.2", title: "Buscar interações", status: "pending" },
      { id: "1.3", title: "Buscar chamadas", status: "pending" },
    ]
  },
  {
    id: "2",
    title: "Identificação de Produto",
    description: "Identificar produto de interesse com IA",
    status: "pending",
    subtasks: [
      { id: "2.1", title: "Carregar lista de produtos", status: "pending" },
      { id: "2.2", title: "Análise de conversas com GPT", status: "pending" },
      { id: "2.3", title: "Validar produto identificado", status: "pending" },
    ]
  },
  {
    id: "3",
    title: "Mapeamento de Playbook",
    description: "Encontrar playbook correspondente ao produto",
    status: "pending",
    subtasks: [
      { id: "3.1", title: "Mapear produto → tipo", status: "pending" },
      { id: "3.2", title: "Buscar playbook do tipo", status: "pending" },
    ]
  },
  {
    id: "4",
    title: "Auditoria de Vendas",
    description: "Análise detalhada com GPT-5",
    status: "pending",
    subtasks: [
      { id: "4.1", title: "Preparar contexto da conversa", status: "pending" },
      { id: "4.2", title: "Enviar para análise GPT-5", status: "pending" },
      { id: "4.3", title: "Extrair compliance score", status: "pending" },
      { id: "4.4", title: "Identificar etapas cumpridas", status: "pending" },
      { id: "4.5", title: "Identificar etapas faltantes", status: "pending" },
    ]
  },
  {
    id: "5",
    title: "Atualização do Lead",
    description: "Salvar resultados da análise",
    status: "pending",
    subtasks: [
      { id: "5.1", title: "Atualizar campos do lead", status: "pending" },
      { id: "5.2", title: "Registrar log de auditoria", status: "pending" },
    ]
  }
];

export default function AIAnalysisPlan({ isAnalyzing, onComplete }: AIAnalysisPlanProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  const prefersReducedMotion = 
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

  useEffect(() => {
    if (!isAnalyzing) {
      setTasks(initialTasks);
      setCurrentTaskIndex(0);
      setExpandedTasks(["1"]);
      return;
    }

    // Simulate task progression
    const progressTasks = async () => {
      const taskTimings = [
        { taskId: "1", duration: 1500 },
        { taskId: "2", duration: 3000 },
        { taskId: "3", duration: 1500 },
        { taskId: "4", duration: 4000 },
        { taskId: "5", duration: 1500 },
      ];

      for (let i = 0; i < taskTimings.length; i++) {
        const { taskId, duration } = taskTimings[i];
        
        // Mark task as in-progress
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: "in-progress" } : t
        ));
        setExpandedTasks(prev => [...new Set([...prev, taskId])]);
        setCurrentTaskIndex(i);

        // Progress through subtasks
        const task = initialTasks.find(t => t.id === taskId);
        if (task) {
          const subtaskDelay = duration / task.subtasks.length;
          for (let j = 0; j < task.subtasks.length; j++) {
            await new Promise(resolve => setTimeout(resolve, subtaskDelay));
            setTasks(prev => prev.map(t => 
              t.id === taskId ? {
                ...t,
                subtasks: t.subtasks.map((st, idx) => 
                  idx === j ? { ...st, status: "completed" } : st
                )
              } : t
            ));
          }
        }

        // Mark task as completed
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: "completed" } : t
        ));
      }

      if (onComplete) {
        onComplete();
      }
    };

    progressTasks();
  }, [isAnalyzing, onComplete]);

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: prefersReducedMotion ? "tween" : "spring" as "spring" | "tween",
        stiffness: 500, 
        damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined
      }
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -5,
      transition: { duration: 0.15 }
    }
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: { 
      height: "auto" as const, 
      opacity: 1,
      overflow: "visible" as const,
      transition: { 
        duration: 0.25, 
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren" as "beforeChildren",
        ease: [0.2, 0.65, 0.3, 0.9] as any
      }
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden" as const,
      transition: { 
        duration: 0.2,
        ease: [0.2, 0.65, 0.3, 0.9] as any
      }
    }
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        type: prefersReducedMotion ? "tween" : "spring" as "spring" | "tween",
        stiffness: 500, 
        damping: 25,
        duration: prefersReducedMotion ? 0.2 : undefined
      }
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -10,
      transition: { duration: 0.15 }
    }
  };

  const statusBadgeVariants = {
    initial: { scale: 1 },
    animate: { 
      scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
      transition: { 
        duration: 0.35,
        ease: [0.34, 1.56, 0.64, 1] as any
      }
    }
  };

  return (
    <div className="bg-background text-foreground h-full overflow-auto">
      <motion.div 
        className="bg-card border-border rounded-lg border shadow overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.3,
            ease: [0.2, 0.65, 0.3, 0.9] as any
          }
        }}
      >
        <LayoutGroup>
          <div className="p-4 overflow-hidden">
            <ul className="space-y-1 overflow-hidden">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);

                return (
                  <motion.li
                    key={task.id}
                    className={` ${index !== 0 ? "mt-1 pt-2" : ""} `}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    <motion.div 
                      className="group flex items-center px-3 py-1.5 rounded-md cursor-pointer"
                      whileHover={{ 
                        backgroundColor: "rgba(0,0,0,0.03)",
                        transition: { duration: 0.2 }
                      }}
                      onClick={() => toggleTaskExpansion(task.id)}
                    >
                      <motion.div className="mr-2 flex-shrink-0">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={task.status}
                            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                            transition={{
                              duration: 0.2,
                              ease: [0.2, 0.65, 0.3, 0.9] as any
                            }}
                          >
                            {task.status === "completed" ? (
                              <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                            ) : task.status === "in-progress" ? (
                              <CircleDotDashed className="h-4.5 w-4.5 text-blue-500" />
                            ) : task.status === "need-help" ? (
                              <CircleAlert className="h-4.5 w-4.5 text-yellow-500" />
                            ) : task.status === "failed" ? (
                              <CircleX className="h-4.5 w-4.5 text-red-500" />
                            ) : (
                              <Circle className="text-muted-foreground h-4.5 w-4.5" />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>

                      <div className="flex min-w-0 flex-grow items-center justify-between">
                        <div className="mr-2 flex-1">
                          <span className="font-medium">{task.title}</span>
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        </div>

                        <motion.span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            task.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : task.status === "in-progress"
                                ? "bg-blue-100 text-blue-700"
                                : task.status === "need-help"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : task.status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-muted text-muted-foreground"
                          }`}
                          variants={statusBadgeVariants}
                          initial="initial"
                          animate="animate"
                          key={task.status}
                        >
                          {task.status === "completed" ? "Concluído" :
                           task.status === "in-progress" ? "Em andamento" :
                           task.status === "failed" ? "Falhou" : "Pendente"}
                        </motion.span>
                      </div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div 
                          className="relative overflow-hidden"
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          layout
                        >
                          <div className="absolute top-0 bottom-0 left-[20px] border-l-2 border-dashed border-muted-foreground/30" />
                          <ul className="border-muted mt-1 mr-2 mb-1.5 ml-3 space-y-0.5">
                            {task.subtasks.map((subtask) => (
                              <motion.li
                                key={subtask.id}
                                className="group flex flex-col py-0.5 pl-6"
                                variants={subtaskVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                              >
                                <motion.div 
                                  className="flex flex-1 items-center rounded-md p-1"
                                  whileHover={{ 
                                    backgroundColor: "rgba(0,0,0,0.03)",
                                    transition: { duration: 0.2 }
                                  }}
                                  layout
                                >
                                  <motion.div className="mr-2 flex-shrink-0" layout>
                                    <AnimatePresence mode="wait">
                                      <motion.div
                                        key={subtask.status}
                                        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                        transition={{
                                          duration: 0.2,
                                          ease: [0.2, 0.65, 0.3, 0.9] as any
                                        }}
                                      >
                                        {subtask.status === "completed" ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                        ) : subtask.status === "in-progress" ? (
                                          <CircleDotDashed className="h-3.5 w-3.5 text-blue-500" />
                                        ) : subtask.status === "need-help" ? (
                                          <CircleAlert className="h-3.5 w-3.5 text-yellow-500" />
                                        ) : subtask.status === "failed" ? (
                                          <CircleX className="h-3.5 w-3.5 text-red-500" />
                                        ) : (
                                          <Circle className="text-muted-foreground h-3.5 w-3.5" />
                                        )}
                                      </motion.div>
                                    </AnimatePresence>
                                  </motion.div>

                                  <span className="text-sm">{subtask.title}</span>
                                </motion.div>
                              </motion.li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}
