import { createStore } from 'solid-js/store';
import { apiGet, apiPost } from '../utils/api';
import type { Todo } from '../types/todo';

export interface TodoStoreState {
  todos: Todo[];
  newTitle: string;
  loading: boolean;
  error: string;
}

const initialState: TodoStoreState = {
  todos: [],
  newTitle: '',
  loading: true,
  error: '',
};

export const [todoStore, setTodoStore] = createStore<TodoStoreState>(initialState);

export const todoStoreActions = {
  fetchTodos: async () => {
    try {
      setTodoStore({ loading: true });
      const data = await apiGet('todos');
      setTodoStore({ todos: data, error: '', loading: false });
    } catch (err) {
      setTodoStore({
        error: err instanceof Error ? err.message : 'Failed to fetch todos',
        loading: false,
      });
    }
  },

  setNewTitle: (title: string) => {
    setTodoStore({ newTitle: title });
  },

  addTodo: async () => {
    const title = todoStore.newTitle;
    if (!title.trim()) return;

    try {
      const todo = await apiPost('todo', { title: title.trim() });
      setTodoStore('todos', prev => [todo, ...prev]);
      setTodoStore({ newTitle: '' });
    } catch (err) {
      setTodoStore({
        error: err instanceof Error ? err.message : 'Failed to add todo',
      });
    }
  },

  toggleTodo: async (todo: Todo) => {
    try {
      const updated = await apiPost('todo', {
        ...todo,
        completed: !todo.completed,
      });
      setTodoStore('todos', prev => prev.map((t) => (t._id === updated._id ? updated : t)));
    } catch (err) {
      setTodoStore({
        error: err instanceof Error ? err.message : 'Failed to update todo',
      });
    }
  },

  deleteTodo: async (id: string) => {
    try {
      await apiPost('deleteTodo', { id });
      setTodoStore('todos', prev => prev.filter((t) => t._id !== id));
    } catch (err) {
      setTodoStore({
        error: err instanceof Error ? err.message : 'Failed to delete todo',
      });
    }
  },

  reset: () => {
    setTodoStore(initialState);
  },
};