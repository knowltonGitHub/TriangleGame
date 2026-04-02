import matplotlib.pyplot as plt
import numpy as np

def draw_atomic_30_60_90_t():
    # 1. Geometric Constants
    # short_leg (s) = 0.5
    # long_leg (l) = sqrt(3)/2 (~0.866)
    s = 0.5
    l = np.sqrt(3) / 2
    
    plt.figure(figsize=(10, 10))
    ax = plt.subplot(1, 1, 1, aspect='equal')
    
    # 2. Define the Filling Function
    # This ensures every 'cell' is split into two non-overlapping 30-60-90 triangles
    def fill_cell(x_start, y_start, color):
        # Triangle 1: Right angle at (x_start, y_start)
        t1_x = [x_start, x_start + s, x_start]
        t1_y = [y_start, y_start, y_start + l]
        ax.fill(t1_x, t1_y, facecolor=color, edgecolor='black', linewidth=1)
        
        # Triangle 2: Right angle at (x_start + s, y_start + l)
        t2_x = [x_start, x_start + s, x_start + s]
        t2_y = [y_start + l, y_start + l, y_start]
        ax.fill(t2_x, t2_y, facecolor=color, edgecolor='black', linewidth=1)

    # 3. Fill THE BASE (10 units wide, 2 units tall)
    # Total Width: 5.0 units (-2.5 to 2.5)
    # Total Height: 1.732 units (0 to 2*l)
    for row in range(0, 2):
        y_pos = row * l
        for col in range(-5, 5):
            x_pos = col * s
            fill_cell(x_pos, y_pos, '#FFCC80') # Light Orange

    # 4. Fill THE SHAFT (4 units wide, 6 units tall)
    # Total Width: 2.0 units (-1.0 to 1.0)
    # Total Height: 5.196 units (from 2*l to 8*l)
    for row in range(2, 8):
        y_pos = row * l
        for col in range(-2, 2):
            x_pos = col * s
            fill_cell(x_pos, y_pos, '#99FF99') # Light Green

    # 5. Draw THE CONTAINER BOUNDARY (Heavy Outline)
    # This matches the user's provided shape exactly
    outline_x = [-2.5, 2.5, 2.5, 1.0, 1.0, -1.0, -1.0, -2.5, -2.5]
    outline_y = [0, 0, 2*l, 2*l, 8*l, 8*l, 2*l, 2*l, 0]
    ax.plot(outline_x, outline_y, color='black', linewidth=4)

    # 6. Final Polish
    ax.axis('off')
    plt.title("Atomic 30-60-90 Triangle Tiling (No Gaps, No Overlaps)", fontsize=14)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    draw_atomic_30_60_90_t()