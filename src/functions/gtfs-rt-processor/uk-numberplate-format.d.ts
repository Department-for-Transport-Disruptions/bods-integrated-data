declare module "uk-numberplate-format" {
    export function validate(input: string, callback: (error: boolean | number) => void): void;
}
