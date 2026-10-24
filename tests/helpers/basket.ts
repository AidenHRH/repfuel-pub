import { fireEvent, screen } from 'expo-router/testing-library';

/** Finishes the meal in Log food's basket ("Log 1 item", "Log 2 items") and waits for Summary. */
export async function finishBasket(): Promise<void> {
  await fireEvent.press(await screen.findByRole('button', { name: /^Log \d+ items?$/ }));
  await screen.findByRole('header', { name: 'Summary' });
}
