import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  useCreateTodo,
  useDeleteTodo,
  useTodos,
  useUpdateTodo,
} from '@/api/todos';
import { createTodoSchema, type CreateTodoValues } from '@/schemas/todo';
import { errorMessage, isValidationError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { TodoRow } from '@/components/todo-row';
import { toast } from '@/components/ui/sonner';

export function TodosListPage() {
  const { data: todos, isLoading, isError, error, refetch } = useTodos();
  const createTodo = useCreateTodo();
  const deleteTodo = useDeleteTodo();

  const form = useForm<CreateTodoValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: { title: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createTodo.mutateAsync({ title: values.title });
      form.reset({ title: '' });
    } catch (err) {
      if (isValidationError(err)) {
        form.setError('title', { message: err.message.join(', ') });
      } else {
        toast.error('Failed to create todo', { description: errorMessage(err) });
      }
    }
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="flex items-start gap-2"
        data-testid="create-form"
        noValidate
      >
        <div className="flex-1">
          <Input
            placeholder="What needs to be done?"
            disabled={createTodo.isPending}
            data-testid="create-title"
            {...form.register('title')}
          />
          {form.formState.errors.title && (
            <p
              className="mt-1 text-sm text-destructive"
              data-testid="create-error"
            >
              {form.formState.errors.title.message}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={createTodo.isPending}
          data-testid="create-submit"
        >
          {createTodo.isPending && <Loader2 className="animate-spin" />}
          Add +
        </Button>
      </form>

      {isLoading && (
        <ul className="space-y-2" data-testid="todos-loading">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </ul>
      )}

      {isError && (
        <Card
          className="p-4 text-sm"
          role="alert"
          data-testid="todos-error"
        >
          <p className="font-medium text-destructive">
            Failed to load todos.
          </p>
          <p className="text-muted-foreground">{errorMessage(error)}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Card>
      )}

      {todos && todos.length === 0 && (
        <p
          className="py-12 text-center text-sm text-muted-foreground"
          data-testid="todos-empty"
        >
          No todos yet. Add one above.
        </p>
      )}

      {todos && todos.length > 0 && (
        <ul className="space-y-2" data-testid="todos-list">
          {todos.map((todo) => (
            <TodoListItem
              key={todo.id}
              todoId={todo.id}
              todo={todo}
              onDelete={async () => {
                try {
                  await deleteTodo.mutateAsync(todo.id);
                } catch (err) {
                  toast.error('Failed to delete todo', {
                    description: errorMessage(err),
                  });
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoListItem({
  todoId,
  todo,
  onDelete,
}: {
  todoId: string;
  todo: import('@/api/client').Todo;
  onDelete: () => void;
}) {
  const updateTodo = useUpdateTodo(todoId);
  return (
    <TodoRow
      todo={todo}
      isToggling={updateTodo.isPending}
      onToggle={async (completed) => {
        try {
          await updateTodo.mutateAsync({ completed });
        } catch (err) {
          toast.error('Failed to update todo', {
            description: errorMessage(err),
          });
        }
      }}
      onDelete={onDelete}
    />
  );
}
