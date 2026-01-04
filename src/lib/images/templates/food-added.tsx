import type { ReactElement } from "react";
import type { MealType } from "@/db/schema";
import {
	colors,
	formatNumber,
	formatTime,
	mealInfo,
	renderToPng,
} from "../index";

export interface FoodAddedData {
	foodName: string;
	quantity: number;
	unit: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	fiber?: number;
	mealType: MealType;
	eatenAt: Date;
}

function MacroBox({
	label,
	value,
	unit,
	color,
}: {
	label: string;
	value: number;
	unit: string;
	color: string;
}): ReactElement {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "16px",
				borderRadius: "12px",
				backgroundColor: "#F9FAFB",
				minWidth: "100px",
			}}
		>
			<span
				style={{
					fontSize: "28px",
					fontWeight: 700,
					color: color,
				}}
			>
				{formatNumber(value)}
			</span>
			<span
				style={{
					fontSize: "14px",
					color: colors.textSecondary,
					marginTop: "4px",
				}}
			>
				{unit} {label}
			</span>
		</div>
	);
}

function FoodAddedTemplate({ data }: { data: FoodAddedData }): ReactElement {
	const meal = mealInfo[data.mealType];

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				backgroundColor: colors.background,
				padding: "40px",
				fontFamily: "Inter",
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					marginBottom: "24px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "48px",
						height: "48px",
						borderRadius: "50%",
						backgroundColor: colors.success,
						marginRight: "16px",
					}}
				>
					<span style={{ fontSize: "24px", color: "white" }}>+</span>
				</div>
				<span
					style={{
						fontSize: "24px",
						fontWeight: 600,
						color: colors.text,
					}}
				>
					Added to your log
				</span>
			</div>

			{/* Divider */}
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "2px",
					backgroundColor: colors.border,
					marginBottom: "32px",
				}}
			/>

			{/* Food name */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginBottom: "32px",
				}}
			>
				<span
					style={{
						fontSize: "32px",
						fontWeight: 700,
						color: colors.text,
						marginBottom: "8px",
					}}
				>
					{data.foodName}
				</span>
				<span
					style={{
						fontSize: "18px",
						color: colors.textSecondary,
					}}
				>
					{data.quantity} {data.unit}
				</span>
			</div>

			{/* Macros grid */}
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "16px",
					marginBottom: "32px",
				}}
			>
				<MacroBox
					label=""
					value={data.calories}
					unit="kcal"
					color={colors.calories}
				/>
				<MacroBox
					label="protein"
					value={data.protein}
					unit="g"
					color={colors.protein}
				/>
				<MacroBox
					label="carbs"
					value={data.carbs}
					unit="g"
					color={colors.carbs}
				/>
				<MacroBox label="fat" value={data.fat} unit="g" color={colors.fat} />
			</div>

			{/* Meal info */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "16px 24px",
					borderRadius: "12px",
					backgroundColor: colors.surface,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "40px",
						height: "40px",
						borderRadius: "50%",
						backgroundColor: meal.color,
						marginRight: "16px",
					}}
				>
					<span style={{ fontSize: "20px", color: "white" }}>
						{data.mealType === "breakfast"
							? "AM"
							: data.mealType === "lunch"
								? "12"
								: data.mealType === "dinner"
									? "PM"
									: "S"}
					</span>
				</div>
				<div style={{ display: "flex", flexDirection: "column" }}>
					<span
						style={{
							fontSize: "16px",
							fontWeight: 600,
							color: colors.text,
						}}
					>
						{meal.label}
					</span>
					<span
						style={{
							fontSize: "14px",
							color: colors.textSecondary,
						}}
					>
						{formatTime(data.eatenAt)}
					</span>
				</div>
			</div>
		</div>
	);
}

export async function renderFoodAdded(data: FoodAddedData): Promise<Buffer> {
	return renderToPng(<FoodAddedTemplate data={data} />, {
		width: 600,
		height: 500,
	});
}
