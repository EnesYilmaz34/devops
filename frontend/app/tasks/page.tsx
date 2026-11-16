'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearSession, getToken, getUsername, Task } from '@/lib/api';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setUsername(getUsername() || '');
    loadTasks();
  }, [router]);

  async function loadTasks() {
    setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data);
      setError('');
    } catch (err) {
      setError('Görevler yüklenemedi. Oturumun sona ermiş olabilir.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const newTask = await api.createTask(title, description);
      setTasks((prev) => [...prev, newTask]);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError('Görev eklenemedi.');
    }
  }

  async function toggleComplete(task: Task) {
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    try {
      await api.updateTask(task.id, updated);
    } catch (err) {
      loadTasks();
    }
  }

  async function handleDelete(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (err) {
      loadTasks();
    }
  }

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  const openTasks = tasks.filter((t) => !t.completed);
  const doneTasks = tasks.filter((t) => t.completed);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Başlık */}
        <header className="flex items-end justify-between mb-10 border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] uppercase text-clay mb-1">
              Defter — {username}
            </p>
            <h1 className="font-display text-3xl font-semibold text-ink">
              Bugünün kayıtları
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="font-mono text-xs uppercase tracking-wide text-moss hover:text-clay transition-colors"
          >
            Çıkış yap
          </button>
        </header>

        {error && (
          <p className="text-clay text-sm font-mono mb-6 border-l-2 border-clay pl-3">
            {error}
          </p>
        )}

        {/* Yeni görev ekleme */}
        <form
          onSubmit={handleAdd}
          className="mb-12 bg-white/50 border border-line rounded-sm p-5"
        >
          <p className="font-mono text-xs uppercase tracking-wide text-moss mb-3">
            Yeni kayıt
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ne yapılacak?"
            required
            className="w-full border-b-2 border-line bg-transparent py-2 font-body text-lg text-ink focus:border-moss transition-colors outline-none mb-3"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Not (opsiyonel)"
            className="w-full border-b border-line bg-transparent py-1.5 font-body text-sm text-ink/80 focus:border-moss transition-colors outline-none mb-4"
          />
          <button
            type="submit"
            className="bg-ink text-paper font-mono text-xs uppercase tracking-wide px-5 py-2.5 rounded-sm hover:bg-moss transition-colors"
          >
            Deftere ekle
          </button>
        </form>

        {loading ? (
          <p className="font-mono text-sm text-moss">yükleniyor…</p>
        ) : tasks.length === 0 ? (
          <p className="font-mono text-sm text-moss italic">
            Defter boş. İlk kaydını yukarıdan ekle.
          </p>
        ) : (
          <div className="space-y-8">
            {openTasks.length > 0 && (
              <section>
                <p className="font-mono text-xs uppercase tracking-wide text-moss mb-3">
                  Açık ({openTasks.length})
                </p>
                <ul className="divide-y divide-line border-t border-b border-line">
                  {openTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggleComplete(task)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {doneTasks.length > 0 && (
              <section>
                <p className="font-mono text-xs uppercase tracking-wide text-moss mb-3">
                  Tamamlandı ({doneTasks.length})
                </p>
                <ul className="divide-y divide-line border-t border-b border-line opacity-60">
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggleComplete(task)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-4 py-4 group">
      <button
        onClick={onToggle}
        aria-label={task.completed ? 'Görevi aç' : 'Görevi tamamla'}
        className={`mt-1 w-5 h-5 flex-shrink-0 border-2 rounded-sm transition-colors ${
          task.completed ? 'bg-moss border-moss' : 'border-ink/40 hover:border-moss'
        }`}
      />
      <div className="flex-1 relative">
        <p
          className={`font-body text-lg text-ink ${
            task.completed ? 'line-through decoration-clay' : ''
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="font-body text-sm text-ink/60 mt-0.5">{task.description}</p>
        )}
        {task.completed && (
          <span className="stamp absolute -top-1 right-0 font-mono text-[10px] uppercase tracking-widest text-clay border border-clay px-2 py-0.5 rounded-sm">
            Bitti
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        aria-label="Görevi sil"
        className="font-mono text-xs text-ink/30 hover:text-clay transition-colors opacity-0 group-hover:opacity-100"
      >
        sil
      </button>
    </li>
  );
}
