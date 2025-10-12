import { Dialog, DialogPanel } from '@headlessui/react';
import { useState } from 'react';
import Console from './components/Console';
import GroceryList from './components/GroceryList';
import { useCategories } from './hooks/useCategories';
import { useGroceryList } from './hooks/useGroceryList';

declare global {
  interface Window {
    APP_CONFIG: {
      isDemo: boolean;
    };
  }
}

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  const groceryListRepository = useGroceryList();
  const categoryRepository = useCategories();

  const onExecuteError = (e: Error) => {
    setError(`${e}`);
    setIsOpen(true);
  }

  const closeModal = () => {
    setIsOpen(false)
    setError('')
  }

  const isDemo = window.APP_CONFIG.isDemo;

  return (
    <div className="min-h-screen bg-white">
      <h1 className="text-2xl font-bold mb-6 pt-4 text-center">Grocery List</h1>

      {isDemo && (
          <div className="bg-amber-200 p-3">
            <p>This is a demo of `gl`. <b>The database resets every 15 minutes</b>.</p>
            <ul className="list-disc list-inside">
              <li>
                Try adding an item to the list. Start typing "chick" and see what autocomplete offers.
              </li>
              <li>
                Try adding or renaming a category. Type "/" and see available slash-commands.
              </li>
            </ul>
          </div>
        )}

      <div className="max-w-md mx-auto p-4"> 

        <Dialog id='1' open={isOpen} onClose={closeModal}>
          <div className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white rounded p-6">
              <p>{error}</p>
              <button className="rounded-md bg-black/20 px-4 py-2 text-sm font-medium text-white focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-black/30" onClick={closeModal}>Close</button>
            </DialogPanel>
          </div>
        </Dialog>

        <Console
          groceryListRepository={groceryListRepository}
          categoryRepository={categoryRepository}
          onExecuteError={onExecuteError}
        />
        <div className="flex">
          <div className="flex flex-1"></div>
          <div className="w-99 justify-center">
            <GroceryList
              groceryListRepository={groceryListRepository}
              categoryRepository={categoryRepository}
            />
          </div>
          <div className="flex flex-1"></div>
        </div>
      </div>
    </div>
  )
}

export default App
